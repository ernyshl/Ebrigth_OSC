import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/crm/db'
import { requireTktAuth, TktAuthError } from '@/lib/crm/tkt-auth'

function err(msg: string, status: number) {
  return Response.json({ error: msg }, { status })
}

function parseDays(sp: URLSearchParams): number {
  const raw = sp.get('days') ?? '30'
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0 || n > 365) return 30
  return n
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTktAuth(req.headers)
    const sp = req.nextUrl.searchParams
    const days = parseDays(sp)
    const from = new Date(Date.now() - days * 24 * 3600 * 1000)

    // All tickets in the window (include archived)
    const tickets = await prisma.tkt_ticket.findMany({
      where: {
        tenant_id: ctx.tenantId,
        created_at: { gte: from },
      },
      include: {
        platform: { select: { id: true, name: true, code: true, accent_color: true } },
        branch:   { select: { id: true, name: true, branch_number: true, code: true } },
      },
      orderBy: { created_at: 'asc' },
    })

    // Totals by status
    const byStatus: Record<string, number> = {
      received: 0,
      in_progress: 0,
      complete: 0,
      rejected: 0,
    }
    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
    }

    // By platform
    const platformMap = new Map<string, { id: string; name: string; code: string; accent_color: string; total: number; open: number; completed: number }>()
    for (const t of tickets) {
      const key = t.platform.id
      const curr =
        platformMap.get(key) ??
        { id: t.platform.id, name: t.platform.name, code: t.platform.code, accent_color: t.platform.accent_color, total: 0, open: 0, completed: 0 }
      curr.total += 1
      if (t.status === 'received' || t.status === 'in_progress') curr.open += 1
      if (t.status === 'complete') curr.completed += 1
      platformMap.set(key, curr)
    }
    const byPlatform = Array.from(platformMap.values()).sort((a, b) => b.total - a.total)

    // By branch — top 10
    const branchMap = new Map<string, { id: string; name: string; code: string; branch_number: string; total: number }>()
    for (const t of tickets) {
      const key = t.branch.id
      const curr =
        branchMap.get(key) ??
        { id: t.branch.id, name: t.branch.name, code: t.branch.code, branch_number: t.branch.branch_number, total: 0 }
      curr.total += 1
      branchMap.set(key, curr)
    }
    const topBranches = Array.from(branchMap.values()).sort((a, b) => b.total - a.total).slice(0, 10)

    // Daily trend
    const trendMap = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000)
      trendMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const t of tickets) {
      const k = new Date(t.created_at).toISOString().slice(0, 10)
      if (trendMap.has(k)) trendMap.set(k, (trendMap.get(k) ?? 0) + 1)
    }
    const trend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))

    // Resolution time + rejection rate
    const completed = tickets.filter((t) => t.status === 'complete' && t.completed_at)
    const avgResolutionMs = completed.length
      ? completed.reduce(
          (sum, t) =>
            sum + (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()),
          0,
        ) / completed.length
      : 0
    const avgResolutionHours = avgResolutionMs / 3_600_000

    const rejectionRate = tickets.length
      ? (byStatus.rejected ?? 0) / tickets.length
      : 0

    // Top admins (by tickets assigned)
    const adminMap = new Map<string, number>()
    for (const t of tickets) {
      if (t.assigned_admin_id) {
        adminMap.set(t.assigned_admin_id, (adminMap.get(t.assigned_admin_id) ?? 0) + 1)
      }
    }
    const adminIds = Array.from(adminMap.keys())
    const adminUsers = adminIds.length
      ? await prisma.crm_auth_user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const topAdmins = adminUsers
      .map((u) => ({ id: u.id, name: u.name ?? u.email, email: u.email, count: adminMap.get(u.id) ?? 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return Response.json({
      period: { days, from: from.toISOString() },
      totals: {
        all:          tickets.length,
        received:     byStatus.received ?? 0,
        in_progress:  byStatus.in_progress ?? 0,
        complete:     byStatus.complete ?? 0,
        rejected:     byStatus.rejected ?? 0,
      },
      byPlatform,
      topBranches,
      trend,
      avgResolutionHours,
      rejectionRate,
      topAdmins,
    })
  } catch (e) {
    if (e instanceof TktAuthError) return err(e.message, e.statusCode)
    console.error('[GET analytics]', e)
    return err('Internal server error', 500)
  }
}

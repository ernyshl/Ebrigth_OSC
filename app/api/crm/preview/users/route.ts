import { NextResponse } from 'next/server'
import { prisma } from '@/lib/crm/db'

/** Lists all crm_auth_users that can be impersonated in preview mode. */
export async function GET() {
  if (process.env.CRM_PREVIEW_MODE !== 'true') {
    return NextResponse.json({ error: 'Preview mode disabled' }, { status: 403 })
  }

  const users = await prisma.crm_auth_user.findMany({
    orderBy: { email: 'asc' },
    select: { id: true, email: true, name: true },
    take: 100,
  })

  // Enrich with tkt role for easier identification
  const ids = users.map((u) => u.id)
  const tktProfiles = await prisma.tkt_user_profile.findMany({
    where: { user_id: { in: ids } },
    select: { user_id: true, role: true },
  })
  const crmBranches = await prisma.crm_user_branch.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, role: true },
  })

  const tktMap = new Map(tktProfiles.map((p) => [p.user_id, p.role]))
  const crmMap = new Map(crmBranches.map((b) => [b.userId, b.role]))

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      tktRole: tktMap.get(u.id) ?? null,
      crmRole: crmMap.get(u.id) ?? null,
    })),
  )
}

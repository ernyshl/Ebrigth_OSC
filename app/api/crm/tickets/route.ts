/**
 * GET  /api/crm/tickets — List tickets (role-scoped)
 * POST /api/crm/tickets — Create a new ticket
 */

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/crm/db'
import { requireTktAuth, TktAuthError } from '@/lib/crm/tkt-auth'
import { logAudit } from '@/lib/crm/audit'
import { enqueueTicketEmail } from '@/lib/crm/queue'
import { createTicketWithNumber } from '@/lib/crm/ticketNumber'
import {
  CreateTicketSchema,
  validateTicketFields,
} from '@/lib/crm/validations/ticket'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

// ─── Error helper ─────────────────────────────────────────────────────────────

function err(msg: string, status: number) {
  return Response.json({ error: msg }, { status })
}

// ─── GET /api/crm/tickets ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTktAuth(req.headers)
    const sp = req.nextUrl.searchParams

    // Parse query params
    const platform        = sp.get('platform') ?? undefined
    const branch          = sp.get('branch') ?? undefined
    const status          = sp.get('status') ?? undefined
    const search          = sp.get('search') ?? undefined
    const dateFrom        = sp.get('dateFrom') ?? undefined
    const dateTo          = sp.get('dateTo') ?? undefined
    const includeArchived = sp.get('includeArchived') === 'true'
    const page            = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
    const pageSize        = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '25', 10)))

    // Build base where clause
    const where: Prisma.tkt_ticketWhereInput = { tenant_id: ctx.tenantId }

    // Role-scoped visibility
    if (ctx.role === 'user') {
      // Basic users: see all tickets submitted from their branch(es).
      // Fall back to own tickets only if no branch assignments exist.
      if (ctx.branchIds.length > 0) {
        where.branch_id = { in: ctx.branchIds }
      } else {
        where.user_id = ctx.userId
      }
    } else if (ctx.role === 'platform_admin') {
      where.platform_id = { in: ctx.platformIds }
    }
    // super_admin sees all

    // Platform filter (by slug)
    if (platform) {
      const plat = await prisma.tkt_platform.findFirst({
        where: { tenant_id: ctx.tenantId, slug: platform },
        select: { id: true },
      })
      if (plat) {
        if (ctx.role === 'platform_admin' && !ctx.platformIds.includes(plat.id)) {
          return Response.json({ data: [], total: 0, page, pageSize })
        }
        where.platform_id = plat.id
      }
    }

    // Branch filter (by branch_number)
    if (branch) {
      where.branch = { branch_number: branch }
    }

    // Status filter
    if (status) {
      where.status = status
    }

    // Search filter (ticket_number or submitter name)
    if (search) {
      where.OR = [
        { ticket_number: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Date range filter
    if (dateFrom || dateTo) {
      const createdFilter: Prisma.DateTimeFilter<'tkt_ticket'> = {}
      if (dateFrom) createdFilter.gte = new Date(dateFrom)
      if (dateTo)   createdFilter.lte = new Date(dateTo)
      where.created_at = createdFilter
    }

    // Visibility filter: hide completed tickets older than visible_until
    if (!(includeArchived && ctx.role === 'super_admin')) {
      const existingAnd = Array.isArray(where.AND)
        ? (where.AND as Prisma.tkt_ticketWhereInput[])
        : where.AND
        ? [where.AND as Prisma.tkt_ticketWhereInput]
        : []

      where.AND = [
        ...existingAnd,
        {
          OR: [
            { status: { not: 'complete' } },
            { visible_until: { gt: new Date() } },
          ],
        },
      ]
    }

    const [tickets, total] = await prisma.$transaction([
      prisma.tkt_ticket.findMany({
        where,
        include: {
          platform:  { select: { id: true, name: true, slug: true, code: true, accent_color: true } },
          branch:    { select: { id: true, name: true, code: true, branch_number: true } },
          submitter: { select: { user_id: true, role: true, email_notifications: true } },
          attachments: true,
          events:      { orderBy: { created_at: 'asc' } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tkt_ticket.count({ where }),
    ])

    return Response.json({ data: tickets, total, page, pageSize })
  } catch (e) {
    if (e instanceof TktAuthError) return err(e.message, e.statusCode)
    console.error('[GET /api/crm/tickets]', e)
    return err('Internal server error', 500)
  }
}

// ─── POST /api/crm/tickets ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireTktAuth(req.headers)

    const body = await req.json()
    const parsed = CreateTicketSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 },
      )
    }

    const { platformSlug, branchId, subType, fields } = parsed.data

    // Load platform by slug
    const platform = await prisma.tkt_platform.findFirst({
      where: { tenant_id: ctx.tenantId, slug: platformSlug },
    })
    if (!platform) return err(`Platform '${platformSlug}' not found`, 404)

    // Load branch
    const branch = await prisma.tkt_branch.findFirst({
      where: { tenant_id: ctx.tenantId, id: branchId },
    })
    if (!branch) return err('Branch not found', 404)

    // Validate dynamic fields
    try {
      validateTicketFields(platformSlug, subType, fields)
    } catch (ve) {
      if (ve instanceof z.ZodError) {
        return Response.json(
          { error: 'Field validation failed', details: ve.flatten() },
          { status: 422 },
        )
      }
      throw ve
    }

    // Create ticket + counter atomically
    const ticket = await prisma.$transaction(async (tx) => {
      const created = await createTicketWithNumber(tx, {
        tenant_id:     ctx.tenantId,
        branch_id:     branchId,
        platform_id:   platform.id,
        user_id:       ctx.userId,
        issue_context: `${platformSlug}/${subType}`,
        sub_type:      subType,
        fields,
        branch_number: branch.branch_number,
        platform_code: platform.code,
      })

      // Write initial status_change event
      await tx.tkt_ticket_event.create({
        data: {
          tenant_id: ctx.tenantId,
          ticket_id: created.id,
          actor_id:  ctx.userId,
          type:      'status_change',
          to_value:  'received',
        },
      })

      return created
    })

    // Enqueue notification email (fire-and-forget)
    void enqueueTicketEmail({
      ticketId:        ticket.id,
      tenantId:        ctx.tenantId,
      event:           'created',
      recipientUserId: ctx.userId,
    })

    // Audit log
    void logAudit({
      tenantId:  ctx.tenantId,
      userId:    ctx.userId,
      userEmail: ctx.email,
      action:    'CREATE',
      entity:    'tkt_ticket',
      entityId:  ticket.id,
      meta:      { ticketNumber: ticket.ticket_number, platformSlug, subType },
    })

    return Response.json(
      { ticketId: ticket.id, ticketNumber: ticket.ticket_number, data: ticket },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof TktAuthError) return err(e.message, e.statusCode)
    console.error('[POST /api/crm/tickets]', e)
    return err('Internal server error', 500)
  }
}

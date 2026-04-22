/**
 * GET    /api/crm/tickets/[id] — Get a single ticket with full details
 * DELETE /api/crm/tickets/[id] — Hard-delete ticket (super_admin only)
 */

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/crm/db'
import { requireTktAuth, TktAuthError } from '@/lib/crm/tkt-auth'
import { logAudit } from '@/lib/crm/audit'
import { deleteS3Object, getPresignedDownloadUrl } from '@/lib/crm/s3'

// ─── Error helper ─────────────────────────────────────────────────────────────

function err(msg: string, status: number) {
  return Response.json({ error: msg }, { status })
}

// ─── Route params ─────────────────────────────────────────────────────────────

interface RouteContext {
  params: Promise<{ id: string }>
}

// ─── GET /api/crm/tickets/[id] ────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await requireTktAuth(req.headers)
    const { id } = await params

    const ticket = await prisma.tkt_ticket.findFirst({
      where: { id, tenant_id: ctx.tenantId },
      include: {
        platform:    true,
        branch:      true,
        submitter:   true,
        attachments: { orderBy: { uploaded_at: 'asc' } },
        events:      { orderBy: { created_at: 'asc' } },
      },
    })

    if (!ticket) return err('Ticket not found', 404)

    // Role-scoped access
    if (ctx.role === 'user' && ticket.user_id !== ctx.userId) {
      return err('Access denied', 403)
    }
    if (ctx.role === 'platform_admin' && !ctx.platformIds.includes(ticket.platform_id)) {
      return err('Access denied', 403)
    }

    // Audit log for super_admin reading archived tickets
    if (
      ctx.role === 'super_admin' &&
      ticket.status === 'complete' &&
      ticket.visible_until &&
      ticket.visible_until < new Date()
    ) {
      void logAudit({
        tenantId:  ctx.tenantId,
        userId:    ctx.userId,
        userEmail: ctx.email,
        action:    'READ',
        entity:    'tkt_ticket',
        entityId:  ticket.id,
        meta:      { archived: true, ticketNumber: ticket.ticket_number },
      })
    }

    // Generate presigned download URLs for attachments
    const attachmentsWithUrls = await Promise.all(
      ticket.attachments.map(async (att) => {
        let downloadUrl: string | null = null
        try {
          downloadUrl = await getPresignedDownloadUrl(att.s3_key)
        } catch {
          // Non-fatal — URL generation failure doesn't break the response
        }
        return { ...att, downloadUrl }
      }),
    )

    return Response.json({
      data: { ...ticket, attachments: attachmentsWithUrls },
    })
  } catch (e) {
    if (e instanceof TktAuthError) return err(e.message, e.statusCode)
    console.error('[GET /api/crm/tickets/[id]]', e)
    return err('Internal server error', 500)
  }
}

// ─── DELETE /api/crm/tickets/[id] ────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await requireTktAuth(req.headers, { roles: ['super_admin'] })
    const { id } = await params

    const ticket = await prisma.tkt_ticket.findFirst({
      where: { id, tenant_id: ctx.tenantId },
      include: { attachments: true },
    })

    if (!ticket) return err('Ticket not found', 404)

    // Delete S3 objects for all attachments
    await Promise.allSettled(
      ticket.attachments.map((att) => deleteS3Object(att.s3_key)),
    )

    // Hard-delete ticket (cascades to attachments + events via FK)
    await prisma.tkt_ticket.delete({ where: { id } })

    void logAudit({
      tenantId:  ctx.tenantId,
      userId:    ctx.userId,
      userEmail: ctx.email,
      action:    'DELETE',
      entity:    'tkt_ticket',
      entityId:  ticket.id,
      meta:      { ticketNumber: ticket.ticket_number },
    })

    return Response.json({ success: true })
  } catch (e) {
    if (e instanceof TktAuthError) return err(e.message, e.statusCode)
    console.error('[DELETE /api/crm/tickets/[id]]', e)
    return err('Internal server error', 500)
  }
}

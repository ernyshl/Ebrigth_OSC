import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/crm/db'
import { requireTktAuth, TktAuthError } from '@/lib/crm/tkt-auth'
import { getPresignedDownloadUrl } from '@/lib/crm/s3'
import { logAudit } from '@/lib/crm/audit'

function err(msg: string, status: number) {
  return Response.json({ error: msg }, { status })
}

const RegisterSchema = z.object({
  s3Key: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().optional(),
  fileType: z.enum(['black_white', 'general', 'other']),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTktAuth(req.headers)
    const { id } = await params

    const attachments = await prisma.tkt_ticket_attachment.findMany({
      where: { ticket_id: id, tenant_id: ctx.tenantId },
      orderBy: { uploaded_at: 'desc' },
    })

    const enriched = await Promise.all(
      attachments.map(async (a) => ({
        ...a,
        downloadUrl: await getPresignedDownloadUrl(a.s3_key).catch(() => null),
      })),
    )

    return Response.json(enriched)
  } catch (e) {
    if (e instanceof TktAuthError) return err(e.message, e.statusCode)
    console.error('[GET /api/crm/tickets/[id]/attachments]', e)
    return err('Internal server error', 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireTktAuth(req.headers)
    const { id } = await params

    const body = await req.json()
    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
    }

    const ticket = await prisma.tkt_ticket.findFirst({
      where: { id, tenant_id: ctx.tenantId },
    })
    if (!ticket) return err('Ticket not found', 404)

    const [attachment] = await prisma.$transaction([
      prisma.tkt_ticket_attachment.create({
        data: {
          ticket_id: id,
          tenant_id: ctx.tenantId,
          file_type: parsed.data.fileType,
          original_name: parsed.data.originalName,
          s3_key: parsed.data.s3Key,
          mime_type: parsed.data.mimeType,
          size_bytes: parsed.data.sizeBytes,
          uploaded_by: ctx.userId,
        },
      }),
      prisma.tkt_ticket_event.create({
        data: {
          tenant_id: ctx.tenantId,
          ticket_id: id,
          actor_id: ctx.userId,
          type: 'attachment_added',
          payload: { fileName: parsed.data.originalName },
        },
      }),
    ])

    void logAudit({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      userEmail: ctx.email,
      action: 'CREATE',
      entity: 'tkt_ticket_attachment',
      entityId: attachment.id,
      meta: { ticketId: id, fileName: parsed.data.originalName },
    })

    return Response.json({ data: attachment }, { status: 201 })
  } catch (e) {
    if (e instanceof TktAuthError) return err(e.message, e.statusCode)
    console.error('[POST /api/crm/tickets/[id]/attachments]', e)
    return err('Internal server error', 500)
  }
}

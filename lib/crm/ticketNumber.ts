/**
 * Ticket number generator — format: YYMM-BBII-00KT
 *   YY   = last 2 digits of year
 *   MM   = 2-digit month
 *   BB   = branch_number (01..26)
 *   II   = platform code (01..05)
 *   00   = reserved
 *   KT   = 4-digit sequential counter per (tenant, YYMM, branch, platform)
 *
 * Example: 2604-0102-0001 = Apr 2026, Ampang (01), Aone (02), ticket #1
 *
 * The counter upsert and ticket insert happen inside the SAME transaction
 * to guarantee atomicity — no PENDING placeholder, no race window.
 */

import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { Prisma } from '@prisma/client'

export type PrismaTx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export interface CreateTicketInput {
  tenant_id: string
  branch_id: string
  platform_id: string
  user_id: string
  issue_context: string
  sub_type: string
  fields: Record<string, unknown>
  branch_number: string   // "01".."26"
  platform_code: string   // "01".."05"
}

export async function createTicketWithNumber(
  tx: PrismaTx,
  input: CreateTicketInput,
) {
  const kl = toZonedTime(new Date(), 'Asia/Kuala_Lumpur')
  const period = format(kl, 'yyMM') // e.g. "2604"

  const counter = await tx.tkt_counter.upsert({
    where: {
      tenant_id_period_branch_id_platform_id: {
        tenant_id: input.tenant_id,
        period,
        branch_id: input.branch_id,
        platform_id: input.platform_id,
      },
    },
    create: {
      tenant_id: input.tenant_id,
      period,
      branch_id: input.branch_id,
      platform_id: input.platform_id,
      value: 1,
    },
    update: { value: { increment: 1 } },
  })

  const seq = String(counter.value).padStart(4, '0')
  const ticket_number = `${period}-${input.branch_number}${input.platform_code}-00${seq}`

  const { branch_number: _bn, platform_code: _pc, ...rest } = input

  return tx.tkt_ticket.create({
    data: { ...rest, ticket_number },
    include: {
      platform: true,
      branch: true,
      submitter: true,
    },
  })
}

'use server'

import { prisma } from '@/lib/crm/db'
import { logAudit } from '@/lib/crm/audit'
import { scopedPrisma } from '@/lib/crm/tenancy'
import { z } from 'zod'

const BranchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  timezone: z.string().default('Asia/Kuala_Lumpur'),
  branchManagerId: z.string().uuid().optional(),
  operatingHours: z
    .record(
      z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
      z.object({
        open: z.boolean(),
        openTime: z.string().optional(),
        closeTime: z.string().optional(),
      }),
    )
    .optional(),
})

type BranchInput = z.infer<typeof BranchSchema>

export async function createBranch(
  tenantId: string,
  userId: string,
  data: BranchInput,
) {
  const parsed = BranchSchema.parse(data)

  const branch = await prisma.crm_branch.create({
    data: {
      tenantId,
      name: parsed.name,
      address: parsed.address ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email || null,
      timezone: parsed.timezone,
      branchManagerId: parsed.branchManagerId ?? null,
      operatingHours: parsed.operatingHours ?? undefined,
    },
  })

  void logAudit({
    tenantId,
    userId,
    action: 'CREATE',
    entity: 'crm_branch',
    entityId: branch.id,
    meta: { name: branch.name },
  })

  return branch
}

export async function updateBranch(
  tenantId: string,
  userId: string,
  branchId: string,
  data: Partial<BranchInput>,
) {
  const scope = scopedPrisma(tenantId)

  const existing = await prisma.crm_branch.findFirst({
    where: scope.where({ id: branchId }),
    select: { id: true },
  })
  if (!existing) throw new Error('Branch not found')

  const branch = await prisma.crm_branch.update({
    where: { id: branchId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.branchManagerId !== undefined ? { branchManagerId: data.branchManagerId } : {}),
      ...(data.operatingHours !== undefined ? { operatingHours: data.operatingHours } : {}),
      updatedAt: new Date(),
    },
  })

  void logAudit({
    tenantId,
    userId,
    action: 'UPDATE',
    entity: 'crm_branch',
    entityId: branchId,
    meta: { fields: Object.keys(data) },
  })

  return branch
}

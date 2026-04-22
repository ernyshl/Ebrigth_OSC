/**
 * Canonical branch list shared by the Trial Class form AND the Opportunities
 * pipeline selector. Idempotent — safe to re-run.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const FORM_BRANCHES = [
  'Online - Zoom Class',
  'Selangor - Ampang',
  'Selangor - Bandar Baru Bangi',
  'Selangor - Bandar Rimbayu',
  'Selangor - Bandar Seri Putra',
  'Selangor - Bandar Tun Hussein Onn',
  'Selangor - Cyberjaya',
  'Selangor - Denai Alam',
  'Selangor - Eco Grandeur',
  'Selangor - Kajang TTDI Grove',
  'Selangor - Klang',
  'Selangor - Kota Damansara',
  'Selangor - Kota Warisan',
  'Selangor - Setia Alam',
  'Selangor - Shah Alam',
  'Selangor - Subang Taipan',
  'Selangor - Bandar Puchong Perdana',
  'Selangor - Taman Sri Gombak',
  'W.P. Kuala Lumpur - Danau Kota',
  'W.P. Kuala Lumpur - Sri Petaling',
  'W.P. Putrajaya - Presint 15',
]

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found')
  const tenantId = tenant.id

  // Template stages from an existing pipeline (keep colours consistent)
  const templatePipeline = await prisma.crm_pipeline.findFirst({
    where: { tenantId },
    include: { stages: { orderBy: { order: 'asc' } } },
  })
  const templateStages = templatePipeline?.stages ?? []
  if (templateStages.length === 0) {
    throw new Error('No template pipeline with stages found — run main CRM seed first')
  }

  let created = 0
  let reused = 0

  for (const name of FORM_BRANCHES) {
    let branch = await prisma.crm_branch.findFirst({ where: { tenantId, name } })
    if (!branch) {
      branch = await prisma.crm_branch.create({
        data: { tenantId, name, timezone: 'Asia/Kuala_Lumpur' },
      })
      created++
    } else {
      reused++
    }

    // Ensure a pipeline + stages exist
    const existing = await prisma.crm_pipeline.findFirst({
      where: { tenantId, branchId: branch.id },
    })
    if (!existing) {
      const pipeline = await prisma.crm_pipeline.create({
        data: { tenantId, branchId: branch.id, name: 'Main Pipeline' },
      })
      await prisma.crm_stage.createMany({
        data: templateStages.map((s) => ({
          tenantId,
          pipelineId: pipeline.id,
          name: s.name,
          shortCode: s.shortCode,
          order: s.order,
          color: s.color,
          stuckHoursYellow: s.stuckHoursYellow,
          stuckHoursRed: s.stuckHoursRed,
        })),
      })
    }
  }

  console.log(`✓ ${FORM_BRANCHES.length} canonical branches ensured (${created} created, ${reused} existed)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

/**
 * Ensure a crm_branch + crm_pipeline + 16 stages exists for every branch that
 * the Trial Class form can submit to. Idempotent — safe to re-run.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BRANCHES: Array<{ number: string; name: string }> = [
  { number: '01', name: 'Ampang' },
  { number: '02', name: 'Anggun City Rawang' },
  { number: '03', name: 'Bangi' },
  { number: '04', name: 'Batu Caves' },
  { number: '05', name: 'Bukit Jalil' },
  { number: '06', name: 'Cheras' },
  { number: '07', name: 'Cyberjaya' },
  { number: '08', name: 'Damansara' },
  { number: '09', name: 'Gombak' },
  { number: '10', name: 'Kajang' },
  { number: '11', name: 'Kelang Lama' },
  { number: '12', name: 'Kepong' },
  { number: '13', name: 'Keramat' },
  { number: '14', name: 'Klang' },
  { number: '15', name: 'Kota Damansara' },
  { number: '16', name: 'Kuchai Lama' },
  { number: '18', name: 'Manjung' },
  { number: '19', name: 'Pandan Indah' },
  { number: '20', name: 'Petaling Jaya' },
  { number: '21', name: 'Puchong' },
  { number: '22', name: 'Rawang' },
  { number: '23', name: 'Selayang' },
  { number: '24', name: 'Semenyih' },
  { number: '26', name: 'Taman Sri Gombak' },
]

// 16-stage default pipeline (cloned from existing first-branch template if available)
const DEFAULT_STAGES = [
  { name: 'New Lead',                shortCode: 'NL',     color: 'slate' },
  { name: 'Follow-Up 1st Attempt',   shortCode: 'FU1',    color: 'slate' },
  { name: 'Follow-Up 2nd Attempt',   shortCode: 'FU2',    color: 'slate' },
  { name: 'Follow-Up 3rd Attempt',   shortCode: 'FU3',    color: 'slate' },
  { name: 'Reschedule',              shortCode: 'RSD',    color: 'slate' },
  { name: 'Confirmed for Trial',     shortCode: 'CT',     color: 'emerald' },
  { name: 'Confirmed No-Show',       shortCode: 'CNS',    color: 'amber' },
  { name: 'Show-Up',                 shortCode: 'SU',     color: 'emerald' },
  { name: 'Show-Up No-Enroll',       shortCode: 'SNE',    color: 'yellow' },
  { name: 'Enrolled',                shortCode: 'ENR',    color: 'emerald' },
  { name: 'Unresponsive Week 1',     shortCode: 'UR_W1',  color: 'slate' },
  { name: 'Unresponsive Week 2',     shortCode: 'UR_W2',  color: 'slate' },
  { name: 'Follow-Up 3 Months',      shortCode: 'FU3M',   color: 'slate' },
  { name: 'Cold Lead',               shortCode: 'CL',     color: 'slate' },
  { name: 'Do Not Disturb',          shortCode: 'DND',    color: 'red' },
  { name: 'Self-Generated',          shortCode: 'SG',     color: 'indigo' },
]

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found — run main CRM seed first')
  const tenantId = tenant.id

  // Try to clone stages from an existing pipeline (keeps colours consistent)
  const templatePipeline = await prisma.crm_pipeline.findFirst({
    where: { tenantId },
    include: { stages: { orderBy: { order: 'asc' } } },
  })
  const templateStages = templatePipeline?.stages.length
    ? templatePipeline.stages.map((s) => ({
        name: s.name,
        shortCode: s.shortCode,
        color: s.color,
        stuckHoursYellow: s.stuckHoursYellow,
        stuckHoursRed: s.stuckHoursRed,
      }))
    : DEFAULT_STAGES.map((s) => ({ ...s, stuckHoursYellow: 24, stuckHoursRed: 48 }))

  let created = 0
  let reused = 0

  for (const b of BRANCHES) {
    // Find or create crm_branch by (tenantId, name)
    let branch = await prisma.crm_branch.findFirst({
      where: { tenantId, name: b.name },
    })
    if (!branch) {
      branch = await prisma.crm_branch.create({
        data: {
          tenantId,
          name: b.name,
          timezone: 'Asia/Kuala_Lumpur',
        },
      })
      created++
    } else {
      reused++
    }

    // Ensure there's a pipeline + stages for this branch
    const existingPipeline = await prisma.crm_pipeline.findFirst({
      where: { tenantId, branchId: branch.id },
      include: { stages: true },
    })
    if (!existingPipeline) {
      const pipeline = await prisma.crm_pipeline.create({
        data: { tenantId, branchId: branch.id, name: 'Main Pipeline' },
      })
      await prisma.crm_stage.createMany({
        data: templateStages.map((s, i) => ({
          tenantId,
          pipelineId: pipeline.id,
          name: s.name,
          shortCode: s.shortCode,
          order: i,
          color: s.color,
          stuckHoursYellow: s.stuckHoursYellow,
          stuckHoursRed: s.stuckHoursRed,
        })),
      })
    }
  }

  console.log(`✓ ${BRANCHES.length} branches ensured (${created} created, ${reused} existed)`)
  console.log(`⚠️  Numbers 17 and 25 intentionally skipped.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

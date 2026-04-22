/**
 * Sync the full HR Recruitment pipeline stage list. Idempotent — existing
 * stages are reused (order + shortCode refreshed), new stages are added, and
 * stages not in the list are removed (opportunities on them are moved to
 * "Candidate" first).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Full stage list in order, with optional shortCode override.
const STAGES: Array<{ name: string; short?: string; color?: string }> = [
  { name: 'Candidate',                short: 'CD',  color: 'slate' },
  { name: 'Intern',                   short: 'INT', color: 'blue' },
  { name: 'Full Time',                short: 'FT',  color: 'emerald' },
  { name: 'Part Timer',               short: 'PT',  color: 'amber' },
  { name: 'Buffer Resume',            short: 'BR',  color: 'indigo' },
  { name: 'Resume Submission',        short: 'RS',  color: 'rose' },
  { name: 'Buffer Video',             short: 'BV',  color: 'indigo' },
  { name: 'Complete Submission',      short: 'VS',  color: 'emerald' },
  { name: 'Health Declaration',       short: 'HD',  color: 'sky' },
  { name: 'Google Search',            short: 'GS',  color: 'slate' },
  { name: 'Interview Date',           short: 'ID',  color: 'violet' },
  { name: 'Follow Up',                short: 'FUP', color: 'amber' },
  { name: 'Shortlisted',              short: 'SL',  color: 'emerald' },
  { name: 'Reschedule',               short: 'RES', color: 'yellow' },
  { name: 'Interviewed',              short: 'INT', color: 'blue' },
  { name: 'Hired',                    short: 'HRD', color: 'emerald' },
  { name: '1st Day Trial',            short: 'D1',  color: 'cyan' },
  { name: '2nd Day Trial',            short: 'D2',  color: 'cyan' },
  { name: '3rd Day Trial',            short: 'D3',  color: 'cyan' },
  { name: 'Send Agreement Letter',    short: 'SAL', color: 'indigo' },
  { name: 'Rejected',                 short: 'RJT', color: 'red' },
  { name: '1st Training Day',         short: 'T1',  color: 'teal' },
  { name: '2nd Training Day',         short: 'T2',  color: 'teal' },
  { name: '3rd Training Day',         short: 'T3',  color: 'teal' },
  { name: 'Access To Payroll',        short: 'ATP', color: 'emerald' },
  { name: 'IOP Sessions 2 Week',      short: 'IOP1', color: 'purple' },
  { name: 'IOP Sessions 2nd Month',   short: 'IOP2', color: 'purple' },
  { name: 'IOP Sessions 3rd Month',   short: 'IOP3', color: 'purple' },
  { name: 'Buffer',                   short: 'BUF', color: 'slate' },
]

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found')

  const pipeline = await prisma.crm_pipeline.findFirst({
    where: {
      tenantId: tenant.id,
      branch: { name: 'Ebright HR' },
    },
    include: { stages: true },
  })
  if (!pipeline) throw new Error('Ebright HR pipeline not found — run seed-hr-branch first')

  const desiredNames = new Set(STAGES.map((s) => s.name))
  const existingByName = new Map(pipeline.stages.map((s) => [s.name, s]))

  // 1. For each existing stage not in desired set, move its opportunities to "Candidate" (we'll add/find that first)
  let candidateStage = existingByName.get('Candidate')

  if (!candidateStage) {
    // Create it first so we can reassign opportunities there
    candidateStage = await prisma.crm_stage.create({
      data: {
        tenantId: tenant.id,
        pipelineId: pipeline.id,
        name: 'Candidate',
        shortCode: 'CD',
        order: 0,
        color: 'slate',
        stuckHoursYellow: 24,
        stuckHoursRed: 48,
      },
    })
    existingByName.set('Candidate', candidateStage)
    console.log(`  + created Candidate (was missing)`)
  }

  for (const stage of pipeline.stages) {
    if (desiredNames.has(stage.name)) continue
    // Move any opportunities on this stage to Candidate, then delete the stage
    const moved = await prisma.crm_opportunity.updateMany({
      where: { stageId: stage.id },
      data: { stageId: candidateStage.id },
    })
    if (moved.count > 0) console.log(`  → re-homed ${moved.count} opp(s) from removed stage "${stage.name}" → Candidate`)

    // Stage history references will dangle as ids; leave as-is for audit trail
    await prisma.crm_stage.delete({ where: { id: stage.id } }).catch((e) => {
      console.warn(`  ! could not delete "${stage.name}":`, (e as Error).message.split('\n')[0])
    })
    console.log(`  ✂ removed "${stage.name}"`)
  }

  // 2. Upsert every desired stage with correct order + shortCode + color
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i]
    const existing = existingByName.get(s.name)
    if (existing) {
      await prisma.crm_stage.update({
        where: { id: existing.id },
        data: {
          order: i,
          shortCode: s.short ?? existing.shortCode,
          color: s.color ?? existing.color,
        },
      })
    } else {
      await prisma.crm_stage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          name: s.name,
          shortCode: s.short ?? s.name.slice(0, 3).toUpperCase(),
          order: i,
          color: s.color ?? 'slate',
          stuckHoursYellow: 24,
          stuckHoursRed: 48,
        },
      })
      console.log(`  + added "${s.name}"`)
    }
  }

  const final = await prisma.crm_stage.findMany({
    where: { pipelineId: pipeline.id },
    select: { name: true, shortCode: true, order: true },
    orderBy: { order: 'asc' },
  })
  console.log(`\n✓ HR pipeline now has ${final.length} stages:`)
  for (const s of final) console.log(`    ${String(s.order + 1).padStart(2, ' ')}. ${s.name} (${s.shortCode})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

/**
 * Collapse duplicate pipelines per branch. After merging legacy branches into
 * canonical ones, multiple pipelines may point at the same branchId. We keep
 * the single pipeline with the most opportunities and re-home the rest into
 * it (matching destination stages by NAME), then delete the losers.
 *
 * Idempotent — safe to re-run.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found')
  const tenantId = tenant.id

  const branches = await prisma.crm_branch.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  })

  let totalDeleted = 0

  for (const branch of branches) {
    const pipelines = await prisma.crm_pipeline.findMany({
      where: { tenantId, branchId: branch.id },
      include: {
        stages: { select: { id: true, name: true, _count: { select: { opportunities: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })
    if (pipelines.length <= 1) continue

    // Keeper = pipeline with the most opportunities (ties → oldest)
    const scored = pipelines.map((p) => ({
      pipeline: p,
      count: p.stages.reduce((s, st) => s + st._count.opportunities, 0),
    }))
    scored.sort((a, b) => b.count - a.count || a.pipeline.createdAt.getTime() - b.pipeline.createdAt.getTime())
    const keeper = scored[0].pipeline
    const losers = scored.slice(1).map((s) => s.pipeline)

    console.log(`  Branch "${branch.name}" — keeping ${keeper.id} (${scored[0].count} opps), merging ${losers.length} duplicate(s)`)

    // Build keeper's stage-by-name map for re-homing
    const keeperStageByName = new Map(keeper.stages.map((s) => [s.name, s.id]))

    for (const loser of losers) {
      for (const loserStage of loser.stages) {
        const destStageId = keeperStageByName.get(loserStage.name)
        if (destStageId) {
          // Re-home opportunities to the matching stage in the keeper pipeline
          await prisma.crm_opportunity.updateMany({
            where: { stageId: loserStage.id },
            data: { stageId: destStageId, pipelineId: keeper.id },
          })
        } else {
          // No matching stage in keeper — create one at the end
          const newStage = await prisma.crm_stage.create({
            data: {
              tenantId,
              pipelineId: keeper.id,
              name: loserStage.name,
              shortCode: (loserStage.name.match(/[A-Z0-9]/g) ?? ['?']).slice(0, 4).join(''),
              order: keeper.stages.length + 1,
              color: 'slate',
              stuckHoursYellow: 24,
              stuckHoursRed: 48,
            },
          })
          keeperStageByName.set(loserStage.name, newStage.id)
          await prisma.crm_opportunity.updateMany({
            where: { stageId: loserStage.id },
            data: { stageId: newStage.id, pipelineId: keeper.id },
          })
          console.log(`    + added missing stage "${loserStage.name}" to keeper`)
        }
      }

      // Any stage_history rows referencing loser stages keep the ref (historical accuracy)
      // — no need to update. Now delete the loser's stages then the loser.
      await prisma.crm_stage.deleteMany({ where: { pipelineId: loser.id } })
      await prisma.crm_pipeline.delete({ where: { id: loser.id } }).catch((err) => {
        console.warn(`    ! could not delete pipeline ${loser.id}:`, (err as Error).message.split('\n')[0])
      })
      totalDeleted++
    }
  }

  console.log(`\n✓ Removed ${totalDeleted} duplicate pipeline(s)`)

  // Final summary
  const final = await prisma.crm_pipeline.findMany({
    where: { tenantId },
    include: { branch: { select: { name: true } } },
    orderBy: { branch: { name: 'asc' } },
  })
  console.log(`\n${final.length} pipelines remaining:\n${final.map((p) => `    • ${p.branch?.name}`).join('\n')}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

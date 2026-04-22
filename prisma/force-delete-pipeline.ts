import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const LOSER  = '8b1e6c32-a6b2-4e72-a4d0-f1a199ed1623'
const KEEPER = '09a68a3c-be33-48f9-9b56-fa3c13250dc7'
;(async () => {
  try {
    const loserStages = await prisma.crm_stage.findMany({ where: { pipelineId: LOSER } })
    const keeperStages = await prisma.crm_stage.findMany({ where: { pipelineId: KEEPER } })
    const byName = new Map(keeperStages.map((s) => [s.name, s.id]))
    for (const ls of loserStages) {
      const dest = byName.get(ls.name)
      if (dest) {
        const u = await prisma.crm_opportunity.updateMany({ where: { stageId: ls.id }, data: { stageId: dest, pipelineId: KEEPER } })
        console.log(`moved ${u.count} opps from ${ls.name}`)
        // Also re-home stage_history references
        await prisma.crm_stage_history.updateMany({ where: { fromStageId: ls.id }, data: { fromStageId: dest } })
        await prisma.crm_stage_history.updateMany({ where: { toStageId: ls.id }, data: { toStageId: dest } })
      }
    }
    // Catch stragglers — opportunities that still reference the loser pipeline
    const firstKeeperStage = keeperStages[0]?.id
    if (firstKeeperStage) {
      const strays = await prisma.crm_opportunity.updateMany({
        where: { pipelineId: LOSER },
        data: { pipelineId: KEEPER, stageId: firstKeeperStage },
      })
      console.log('rehomed stray opps:', strays.count)
    }
    await prisma.crm_stage.deleteMany({ where: { pipelineId: LOSER } })
    await prisma.crm_pipeline.delete({ where: { id: LOSER } })
    console.log('✓ deleted')
    const total = await prisma.crm_pipeline.count()
    console.log('total pipelines now:', total)
  } catch (e) {
    console.error((e as Error).message)
  } finally {
    await prisma.$disconnect()
  }
})()

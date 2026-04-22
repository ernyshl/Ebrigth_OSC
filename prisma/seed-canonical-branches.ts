/**
 * Canonical branch list — single source of truth. Renames legacy branch rows
 * to their simple names (dropping "Selangor - ", "W.P. ... - " prefixes) and
 * consolidates duplicates by moving their opportunities/contacts/pipelines to
 * the canonical branch and deleting the empty duplicate.
 *
 * Idempotent — safe to re-run.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Ordered by Region A → B → C
export const CANONICAL_BRANCHES = [
  'Rimbayu',
  'Klang',
  'Shah Alam',
  'Setia Alam',
  'Denai Alam',
  'Eco Grandeur',
  'Subang Taipan',
  'Danau Kota',
  'Kota Damansara',
  'Ampang',
  'Sri Petaling',
  'Bandar Tun Hussein Onn',
  'Kajang TTDI Grove',
  'Taman Sri Gombak',
  'Putrajaya',
  'Kota Warisan',
  'Bandar Baru Bangi',
  'Cyberjaya',
  'Bandar Seri Putra',
  'Dataran Puchong Utama',
  'Online',
] as const

// Map every legacy name we've ever used → its canonical name
const RENAME_MAP: Record<string, string> = {
  // Long-form names from the trial form
  'Online - Zoom Class':                    'Online',
  'Selangor - Ampang':                      'Ampang',
  'Selangor - Bandar Baru Bangi':           'Bandar Baru Bangi',
  'Selangor - Bandar Rimbayu':              'Rimbayu',
  'Selangor - Bandar Seri Putra':           'Bandar Seri Putra',
  'Selangor - Bandar Tun Hussein Onn':      'Bandar Tun Hussein Onn',
  'Selangor - Cyberjaya':                   'Cyberjaya',
  'Selangor - Denai Alam':                  'Denai Alam',
  'Selangor - Eco Grandeur':                'Eco Grandeur',
  'Selangor - Kajang TTDI Grove':           'Kajang TTDI Grove',
  'Selangor - Klang':                       'Klang',
  'Selangor - Kota Damansara':              'Kota Damansara',
  'Selangor - Kota Warisan':                'Kota Warisan',
  'Selangor - Setia Alam':                  'Setia Alam',
  'Selangor - Shah Alam':                   'Shah Alam',
  'Selangor - Subang Taipan':               'Subang Taipan',
  'Selangor - Bandar Puchong Perdana':      'Dataran Puchong Utama',
  'Selangor - Taman Sri Gombak':            'Taman Sri Gombak',
  'W.P. Kuala Lumpur - Danau Kota':         'Danau Kota',
  'W.P. Kuala Lumpur - Sri Petaling':       'Sri Petaling',
  'W.P. Putrajaya - Presint 15':            'Putrajaya',
  // Legacy demo names — keep them mapped so test data consolidates
  'KL Branch':      'Danau Kota',
  'PJ Branch':      'Ampang',
  'Subang Branch':  'Subang Taipan',
}

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found')
  const tenantId = tenant.id

  // 1. Ensure every canonical branch exists
  for (const name of CANONICAL_BRANCHES) {
    const existing = await prisma.crm_branch.findFirst({ where: { tenantId, name } })
    if (!existing) {
      await prisma.crm_branch.create({
        data: { tenantId, name, timezone: 'Asia/Kuala_Lumpur' },
      })
      console.log(`  + created ${name}`)
    }
  }

  // 2. For each legacy branch, move all its data to the canonical branch, then delete
  for (const [legacyName, canonicalName] of Object.entries(RENAME_MAP)) {
    const legacy = await prisma.crm_branch.findFirst({ where: { tenantId, name: legacyName } })
    if (!legacy) continue
    const canonical = await prisma.crm_branch.findFirst({ where: { tenantId, name: canonicalName } })
    if (!canonical) {
      console.warn(`  ! canonical missing for ${canonicalName} — skipping`)
      continue
    }
    if (legacy.id === canonical.id) continue

    console.log(`  → migrating "${legacyName}" → "${canonicalName}"`)

    // Move all owned rows to the canonical branch
    await prisma.crm_contact.updateMany({
      where: { branchId: legacy.id },
      data:  { branchId: canonical.id },
    })
    await prisma.crm_opportunity.updateMany({
      where: { branchId: legacy.id },
      data:  { branchId: canonical.id },
    })
    await prisma.crm_pipeline.updateMany({
      where: { branchId: legacy.id },
      data:  { branchId: canonical.id },
    })
    await prisma.crm_task.updateMany({
      where: { branchId: legacy.id },
      data:  { branchId: canonical.id },
    })
    await prisma.crm_message.updateMany({
      where: { branchId: legacy.id },
      data:  { branchId: canonical.id },
    })
    await prisma.crm_appointment.updateMany({
      where: { branchId: legacy.id },
      data:  { branchId: canonical.id },
    })

    // crm_user_branch has composite unique (userId, branchId) — move carefully
    const links = await prisma.crm_user_branch.findMany({ where: { branchId: legacy.id } })
    for (const link of links) {
      // If user is already linked to canonical, skip this one. Otherwise re-link.
      const already = await prisma.crm_user_branch.findFirst({
        where: { userId: link.userId, branchId: canonical.id },
      })
      if (already) {
        await prisma.crm_user_branch.delete({ where: { id: link.id } })
      } else {
        await prisma.crm_user_branch.update({
          where: { id: link.id },
          data: { branchId: canonical.id },
        })
      }
    }

    // Per-branch settings (email, whatsapp) — unique by branchId. Move only if
    // the canonical doesn't already have one.
    const legacyEmail = await prisma.crm_email_settings.findUnique({ where: { branchId: legacy.id } })
    if (legacyEmail) {
      const existing = await prisma.crm_email_settings.findUnique({ where: { branchId: canonical.id } })
      if (existing) await prisma.crm_email_settings.delete({ where: { branchId: legacy.id } })
      else          await prisma.crm_email_settings.update({ where: { branchId: legacy.id }, data: { branchId: canonical.id } })
    }
    const legacyWA = await prisma.crm_whatsapp_settings.findUnique({ where: { branchId: legacy.id } })
    if (legacyWA) {
      const existing = await prisma.crm_whatsapp_settings.findUnique({ where: { branchId: canonical.id } })
      if (existing) await prisma.crm_whatsapp_settings.delete({ where: { branchId: legacy.id } })
      else          await prisma.crm_whatsapp_settings.update({ where: { branchId: legacy.id }, data: { branchId: canonical.id } })
    }

    // Other tables that may ref branchId via non-null relations
    await prisma.crm_website_form.updateMany({ where: { branchId: legacy.id }, data: { branchId: canonical.id } })
    await prisma.crm_integration.updateMany({ where: { branchId: legacy.id }, data: { branchId: canonical.id } })

    // Custom values use a different scope, leave them alone

    // Finally drop the legacy branch (may still have FK refs we haven't covered)
    try {
      await prisma.crm_branch.delete({ where: { id: legacy.id } })
    } catch (err) {
      console.warn(`  ! could not delete legacy "${legacyName}":`, (err as Error).message.split('\n')[0])
    }
  }

  // 3. Drop any remaining non-canonical branches in the tenant (e.g. stale ones)
  const extras = await prisma.crm_branch.findMany({
    where: { tenantId, name: { notIn: [...CANONICAL_BRANCHES] } },
    select: { id: true, name: true },
  })
  for (const extra of extras) {
    // Only drop if nothing else references it
    const [oppCount, contactCount, pipelineCount] = await Promise.all([
      prisma.crm_opportunity.count({ where: { branchId: extra.id } }),
      prisma.crm_contact.count({ where: { branchId: extra.id } }),
      prisma.crm_pipeline.count({ where: { branchId: extra.id } }),
    ])
    if (oppCount === 0 && contactCount === 0 && pipelineCount === 0) {
      await prisma.crm_branch.delete({ where: { id: extra.id } }).catch(() => undefined)
      console.log(`  ✂ removed empty extra "${extra.name}"`)
    } else {
      console.warn(`  ! kept non-canonical "${extra.name}" (has data) — map it manually if needed`)
    }
  }

  // 4. Make sure every canonical branch has a pipeline
  const template = await prisma.crm_pipeline.findFirst({
    where: { tenantId },
    include: { stages: { orderBy: { order: 'asc' } } },
  })
  if (template?.stages.length) {
    for (const name of CANONICAL_BRANCHES) {
      const branch = await prisma.crm_branch.findFirst({ where: { tenantId, name } })
      if (!branch) continue
      const existing = await prisma.crm_pipeline.findFirst({
        where: { tenantId, branchId: branch.id },
      })
      if (!existing) {
        const pipeline = await prisma.crm_pipeline.create({
          data: { tenantId, branchId: branch.id, name: 'Main Pipeline' },
        })
        await prisma.crm_stage.createMany({
          data: template.stages.map((s) => ({
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
        console.log(`  + pipeline for ${name}`)
      }
    }
  }

  const final = await prisma.crm_branch.findMany({
    where: { tenantId },
    select: { name: true },
    orderBy: { name: 'asc' },
  })
  console.log(`\n✓ ${final.length} branches in tenant:`)
  for (const b of final) console.log(`    • ${b.name}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

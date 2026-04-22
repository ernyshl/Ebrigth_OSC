/**
 * Final dedup + cleanup pass: after canonical-branches migration, there are
 * still duplicate rows (same name, multiple ids) and legacy non-canonical
 * branches. This collapses all of them into a single clean canonical list.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CANONICAL = new Set([
  'Rimbayu', 'Klang', 'Shah Alam', 'Setia Alam', 'Denai Alam', 'Eco Grandeur', 'Subang Taipan',
  'Danau Kota', 'Kota Damansara', 'Ampang', 'Sri Petaling', 'Bandar Tun Hussein Onn', 'Kajang TTDI Grove', 'Taman Sri Gombak',
  'Putrajaya', 'Kota Warisan', 'Bandar Baru Bangi', 'Cyberjaya', 'Bandar Seri Putra', 'Dataran Puchong Utama', 'Online',
])

/** Which branch should legacy non-canonical branches fold into? */
const LEGACY_TO_CANONICAL: Record<string, string> = {
  'Kajang':       'Kajang TTDI Grove',
  'Kelang Lama':  'Klang',
  'Gombak':       'Taman Sri Gombak',
  'Kepong':       'Danau Kota',
  'Keramat':      'Ampang',
  'Kuchai Lama':  'Sri Petaling',
  'Manjung':      'Online',
  'Pandan Indah': 'Ampang',
  'Petaling Jaya': 'Ampang',
  'Puchong':      'Dataran Puchong Utama',
  'Rawang':       'Rimbayu',
  'Selayang':     'Taman Sri Gombak',
  'Semenyih':     'Kajang TTDI Grove',
  'Bukit Jalil':  'Sri Petaling',
  'Cheras':       'Ampang',
  'Damansara':    'Kota Damansara',
  'Bangi':        'Bandar Baru Bangi',
  'Batu Caves':   'Taman Sri Gombak',
  'Anggun City Rawang': 'Rimbayu',
}

async function moveAllData(fromId: string, toId: string) {
  await prisma.crm_contact.updateMany({ where: { branchId: fromId }, data: { branchId: toId } })
  await prisma.crm_opportunity.updateMany({ where: { branchId: fromId }, data: { branchId: toId } })
  await prisma.crm_pipeline.updateMany({ where: { branchId: fromId }, data: { branchId: toId } })
  await prisma.crm_task.updateMany({ where: { branchId: fromId }, data: { branchId: toId } })
  await prisma.crm_message.updateMany({ where: { branchId: fromId }, data: { branchId: toId } })
  await prisma.crm_appointment.updateMany({ where: { branchId: fromId }, data: { branchId: toId } })
  await prisma.crm_website_form.updateMany({ where: { branchId: fromId }, data: { branchId: toId } })
  await prisma.crm_integration.updateMany({ where: { branchId: fromId }, data: { branchId: toId } }).catch(() => undefined)

  // User-branch links (composite unique) — move only if no clash
  const links = await prisma.crm_user_branch.findMany({ where: { branchId: fromId } })
  for (const link of links) {
    const clash = await prisma.crm_user_branch.findFirst({ where: { userId: link.userId, branchId: toId } })
    if (clash) await prisma.crm_user_branch.delete({ where: { id: link.id } })
    else       await prisma.crm_user_branch.update({ where: { id: link.id }, data: { branchId: toId } })
  }

  // Per-branch settings (unique by branchId)
  for (const table of ['crm_email_settings', 'crm_whatsapp_settings'] as const) {
    const legacy = await (prisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown>; delete: (a: unknown) => Promise<unknown>; update: (a: unknown) => Promise<unknown> }>)[table].findUnique({ where: { branchId: fromId } })
    if (!legacy) continue
    const existing = await (prisma as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[table].findUnique({ where: { branchId: toId } })
    if (existing) {
      await (prisma as unknown as Record<string, { delete: (a: unknown) => Promise<unknown> }>)[table].delete({ where: { branchId: fromId } })
    } else {
      await (prisma as unknown as Record<string, { update: (a: unknown) => Promise<unknown> }>)[table].update({ where: { branchId: fromId }, data: { branchId: toId } })
    }
  }
}

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found')
  const tenantId = tenant.id

  const allBranches = await prisma.crm_branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  })

  // Group by name to find duplicates
  const byName = new Map<string, string[]>()
  for (const b of allBranches) {
    const list = byName.get(b.name) ?? []
    list.push(b.id)
    byName.set(b.name, list)
  }

  // 1. Collapse duplicates of canonical names (keep oldest, merge rest into it)
  for (const name of CANONICAL) {
    const ids = byName.get(name) ?? []
    if (ids.length <= 1) continue
    const [keeper, ...duplicates] = ids
    for (const dup of duplicates) {
      console.log(`  ⧖ merging duplicate "${name}" (${dup}) → (${keeper})`)
      await moveAllData(dup, keeper)
      await prisma.crm_branch.delete({ where: { id: dup } }).catch((e) => {
        console.warn(`    ! could not delete ${dup}:`, (e as Error).message.split('\n')[0])
      })
    }
  }

  // 2. Fold legacy non-canonical names into their canonical mappings
  for (const [legacyName, canonicalName] of Object.entries(LEGACY_TO_CANONICAL)) {
    const legacy = await prisma.crm_branch.findFirst({ where: { tenantId, name: legacyName } })
    if (!legacy) continue
    const canonical = await prisma.crm_branch.findFirst({ where: { tenantId, name: canonicalName } })
    if (!canonical) continue
    console.log(`  → merging legacy "${legacyName}" → "${canonicalName}"`)
    await moveAllData(legacy.id, canonical.id)
    await prisma.crm_branch.delete({ where: { id: legacy.id } }).catch((e) => {
      console.warn(`    ! could not delete legacy "${legacyName}":`, (e as Error).message.split('\n')[0])
    })
  }

  // 3. Any remaining non-canonical branches — delete if empty, warn otherwise
  const stragglers = await prisma.crm_branch.findMany({
    where: { tenantId, name: { notIn: [...CANONICAL] } },
  })
  for (const s of stragglers) {
    const [opp, contact, pipe] = await Promise.all([
      prisma.crm_opportunity.count({ where: { branchId: s.id } }),
      prisma.crm_contact.count({ where: { branchId: s.id } }),
      prisma.crm_pipeline.count({ where: { branchId: s.id } }),
    ])
    if (opp + contact + pipe === 0) {
      await prisma.crm_branch.delete({ where: { id: s.id } }).catch(() => undefined)
      console.log(`  ✂ removed empty "${s.name}"`)
    } else {
      console.warn(`  ! kept "${s.name}" (${opp} opps, ${contact} contacts, ${pipe} pipelines)`)
    }
  }

  const final = await prisma.crm_branch.findMany({
    where: { tenantId },
    select: { name: true },
    orderBy: { name: 'asc' },
  })
  console.log(`\n✓ ${final.length} branches remaining:\n${final.map((b) => '    • ' + b.name).join('\n')}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

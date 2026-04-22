/**
 * Rename every crm_branch to the final presentation format:
 *   "Ebright HR"                              ← always first, no number
 *   "01 Ebright English Speaking (Rimbayu)"   ← region A order
 *   "02 Ebright English Speaking (Klang)"
 *   ...
 * Numbering walks through regions A → B → C using the canonical sort.
 *
 * Idempotent — safe to re-run. Handles both the short-name state and the
 * already-renamed-with-prefix state.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Region-ordered canonical list (short names)
const ORDERED = [
  'Rimbayu', 'Klang', 'Shah Alam', 'Setia Alam', 'Denai Alam', 'Eco Grandeur', 'Subang Taipan',
  'Danau Kota', 'Kota Damansara', 'Ampang', 'Sri Petaling', 'Bandar Tun Hussein Onn', 'Kajang TTDI Grove', 'Taman Sri Gombak',
  'Putrajaya', 'Kota Warisan', 'Bandar Baru Bangi', 'Cyberjaya', 'Bandar Seri Putra', 'Dataran Puchong Utama', 'Online',
]

function newName(short: string, index: number): string {
  const num = String(index + 1).padStart(2, '0')
  return `${num} Ebright English Speaking (${short})`
}

function HR_FINAL_NAME() {
  return 'Ebright HR'
}

/** Match a row's current name back to its short canonical name so renames are
 *  idempotent even on re-runs. */
function shortFrom(name: string): string | null {
  if (name === 'HR' || name === HR_FINAL_NAME()) return 'HR'
  // Already renamed pattern: "NN Ebright English Speaking (Short)"
  const m = name.match(/^\d{2}\s+Ebright English Speaking\s+\((.+?)\)\s*$/)
  if (m) return m[1]
  // Not renamed yet — name IS the short
  if (ORDERED.includes(name)) return name
  return null
}

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found')
  const tenantId = tenant.id

  const all = await prisma.crm_branch.findMany({ where: { tenantId } })

  for (const b of all) {
    const short = shortFrom(b.name)
    if (!short) {
      console.log(`  ? skipping unknown branch "${b.name}"`)
      continue
    }

    let desired: string
    if (short === 'HR') {
      desired = HR_FINAL_NAME()
    } else {
      const idx = ORDERED.indexOf(short)
      if (idx < 0) continue
      desired = newName(short, idx)
    }

    if (b.name === desired) continue
    await prisma.crm_branch.update({
      where: { id: b.id },
      data: { name: desired },
    })
    console.log(`  ↻ "${b.name}" → "${desired}"`)
  }

  const final = await prisma.crm_branch.findMany({
    where: { tenantId },
    select: { name: true },
    orderBy: { name: 'asc' },
  })
  console.log(`\n✓ ${final.length} branches:\n${final.map((b) => '    • ' + b.name).join('\n')}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

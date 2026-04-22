import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PLATFORMS = [
  { name: 'Aone',           slug: 'aone',           code: '01', accent_color: '#dc2626' },
  { name: 'GHL',            slug: 'ghl',            code: '02', accent_color: '#2563eb' },
  { name: 'Process Street', slug: 'process-street', code: '03', accent_color: '#7c3aed' },
  { name: 'ClickUp',        slug: 'clickup',        code: '04', accent_color: '#0891b2' },
  { name: 'Other',          slug: 'other',          code: '05', accent_color: '#6b7280' },
]

const BRANCHES = [
  ['01', 'AMP', 'Ampang'],
  ['02', 'ACR', 'Anggun City Rawang'],
  ['03', 'BGI', 'Bangi'],
  ['04', 'BCV', 'Batu Caves'],
  ['05', 'BKJ', 'Bukit Jalil'],
  ['06', 'CHR', 'Cheras'],
  ['07', 'CYJ', 'Cyberjaya'],
  ['08', 'DMS', 'Damansara'],
  ['09', 'GMB', 'Gombak'],
  ['10', 'KJG', 'Kajang'],
  ['11', 'KLM', 'Kelang Lama'],
  ['12', 'KPG', 'Kepong'],
  ['13', 'KRM', 'Keramat'],
  ['14', 'KLG', 'Klang'],
  ['15', 'KDM', 'Kota Damansara'],
  ['16', 'KCL', 'Kuchai Lama'],
  ['17', 'B17', 'Branch-17'],
  ['18', 'MJG', 'Manjung'],
  ['19', 'PDI', 'Pandan Indah'],
  ['20', 'PJY', 'Petaling Jaya'],
  ['21', 'PCG', 'Puchong'],
  ['22', 'RWG', 'Rawang'],
  ['23', 'SLY', 'Selayang'],
  ['24', 'SMY', 'Semenyih'],
  ['25', 'B25', 'Branch-25'],
  ['26', 'TSG', 'Taman Sri Gombak'],
]

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({ where: { slug: 'ebright-demo' } })
  if (!tenant) throw new Error('Tenant ebright-demo not found')
  const tenantId = tenant.id

  console.log(`Seeding tickets for tenant ${tenantId}`)

  // Platforms
  for (const p of PLATFORMS) {
    await prisma.tkt_platform.upsert({
      where: { tenant_id_slug: { tenant_id: tenantId, slug: p.slug } },
      create: { tenant_id: tenantId, ...p },
      update: { name: p.name, code: p.code, accent_color: p.accent_color },
    })
  }
  console.log(`✓ ${PLATFORMS.length} platforms`)

  // Branches
  for (const [branch_number, code, name] of BRANCHES) {
    await prisma.tkt_branch.upsert({
      where: { tenant_id_branch_number: { tenant_id: tenantId, branch_number } },
      create: { tenant_id: tenantId, branch_number, code, name },
      update: { code, name },
    })
  }
  console.log(`✓ ${BRANCHES.length} branches`)

  // Super admin profile for admin@ebright.my
  const adminUser = await prisma.crm_auth_user.findUnique({ where: { email: 'admin@ebright.my' } })
  if (adminUser) {
    await prisma.tkt_user_profile.upsert({
      where: { user_id: adminUser.id },
      create: { user_id: adminUser.id, tenant_id: tenantId, role: 'super_admin' },
      update: { role: 'super_admin' },
    })
    // Assign to all platforms
    const platforms = await prisma.tkt_platform.findMany({ where: { tenant_id: tenantId } })
    for (const p of platforms) {
      await prisma.tkt_user_platform.upsert({
        where: { user_id_platform_id: { user_id: adminUser.id, platform_id: p.id } },
        create: { user_id: adminUser.id, platform_id: p.id },
        update: {},
      })
    }
    console.log(`✓ admin@ebright.my → super_admin, linked to all ${platforms.length} platforms`)
  }

  console.log('⚠️  TODO: Rename branches 17 and 25 before going live.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

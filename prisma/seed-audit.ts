import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({ where: { slug: 'ebright-demo' } })
  if (!tenant) throw new Error('Tenant ebright-demo not found')

  const admin = await prisma.crm_auth_user.findUnique({ where: { email: 'admin@ebright.my' } })
  if (!admin) throw new Error('admin@ebright.my not found')

  const now = Date.now()
  const hour = 3600 * 1000

  const entries: Array<{
    action:  'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT'
    entity:  string
    entityId?: string
    meta?:   Record<string, unknown>
    ipAddress?: string
    minutesAgo: number
  }> = [
    { action: 'LOGIN',  entity: 'crm_auth_user',    minutesAgo: 1,    ipAddress: '10.0.0.14' },
    { action: 'CREATE', entity: 'tkt_ticket',       entityId: 'abcd1234-1111-0000-0000-000000000001', meta: { ticketNumber: '2604-0102-0001', platformSlug: 'aone' }, minutesAgo: 25, ipAddress: '10.0.0.14' },
    { action: 'UPDATE', entity: 'tkt_ticket',       entityId: 'abcd1234-1111-0000-0000-000000000001', meta: { status: 'in_progress' }, minutesAgo: 60, ipAddress: '10.0.0.14' },
    { action: 'CREATE', entity: 'tkt_user_profile', entityId: 'abcd1234-2222-0000-0000-000000000001', meta: { email: 'ahmad@ebright.my', role: 'user' }, minutesAgo: 90 },
    { action: 'CREATE', entity: 'crm_contact',      entityId: 'abcd1234-3333-0000-0000-000000000001', meta: { firstName: 'Nurul', lastName: 'Aina' }, minutesAgo: 120 },
    { action: 'EXPORT', entity: 'crm_contact',      meta: { count: 80, format: 'csv' }, minutesAgo: 180 },
    { action: 'UPDATE', entity: 'tkt_platform',     entityId: 'abcd1234-4444-0000-0000-000000000001', meta: { name: 'Aone' }, minutesAgo: 240 },
    { action: 'DELETE', entity: 'crm_tag',          entityId: 'abcd1234-5555-0000-0000-000000000001', meta: { name: 'Archived' }, minutesAgo: 360 },
    { action: 'CREATE', entity: 'crm_api_key',      meta: { name: 'Production Integration', scopes: ['contacts:read', 'opportunities:read'] }, minutesAgo: 720 },
    { action: 'LOGOUT', entity: 'crm_auth_user',    minutesAgo: 1440 },
  ]

  for (const e of entries) {
    await prisma.core_audit_log.create({
      data: {
        tenantId:  tenant.id,
        userId:    admin.id,
        userEmail: admin.email,
        action:    e.action,
        entity:    e.entity,
        entityId:  e.entityId ?? null,
        meta:      e.meta ?? undefined,
        ipAddress: e.ipAddress ?? null,
        userAgent: 'Mozilla/5.0 (seed)',
        createdAt: new Date(now - e.minutesAgo * 60 * 1000),
      },
    })
  }

  console.log(`✓ Inserted ${entries.length} sample audit log entries`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

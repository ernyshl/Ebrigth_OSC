import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

const MY_NAMES_FIRST = [
  'Ahmad','Siti','Muhammad','Nur','Abdullah','Fatimah','Ali','Aminah',
  'Hassan','Zainab','Ibrahim','Mariam','Ismail','Nabilah','Yusof','Rahmah',
  'Azman','Haslinda','Rozman','Noraini','Khairul','Suraya','Hafiz','Wahidah',
  'Farouk','Norhayati','Rais','Sakinah','Zulkifli','Hasna',
]
const MY_NAMES_LAST = [
  'bin Ahmad','binti Hassan','bin Abdullah','binti Ibrahim','bin Ismail',
  'binti Ali','bin Yusof','binti Azman','bin Rozman','binti Zulkifli',
  'bin Karim','binti Rahmah','bin Fauzi','binti Nordin','bin Latif',
]
const CHILD_NAMES = [
  'Aryan','Aisha','Rayyan','Safiya','Mikail','Zara','Idris','Layla',
  'Omar','Hana','Yusuf','Amira','Adam','Sara','Luqman','Nadia',
]
const PACKAGES = ['Starter Pack RM 3,800','Premium Pack RM 5,200','Elite Pack RM 7,500','Trial RM 500']
const TRIAL_DAYS = ['WED','THU','FRI','SAT','SUN'] as const

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }

async function main() {
  console.log('🌱 Seeding CRM database…')

  // ── Tenant ───────────────────────────────────────────
  const tenantId = randomUUID()
  await prisma.crm_tenant.upsert({
    where: { slug: 'ebright-demo' },
    update: {},
    create: { id: tenantId, name: 'Ebright Demo', slug: 'ebright-demo' },
  })

  // ── Branches ─────────────────────────────────────────
  const branchDefs = [
    { name: 'KL Branch', address: 'No. 1, Jalan Ampang, 50450 Kuala Lumpur', phone: '+60321234567', email: 'kl@ebright.my' },
    { name: 'PJ Branch', address: 'No. 5, Jalan SS2/24, 47300 Petaling Jaya', phone: '+60378901234', email: 'pj@ebright.my' },
    { name: 'Subang Branch', address: 'No. 10, Persiaran Subang 1, 40150 Shah Alam', phone: '+60356789012', email: 'subang@ebright.my' },
  ]
  const branches: { id: string; name: string }[] = []
  for (const b of branchDefs) {
    const existing = await prisma.crm_branch.findFirst({ where: { tenantId, name: b.name } })
    if (existing) { branches.push(existing); continue }
    const branch = await prisma.crm_branch.create({
      data: {
        id: randomUUID(), tenantId, name: b.name, address: b.address,
        phone: b.phone, email: b.email, timezone: 'Asia/Kuala_Lumpur',
      },
    })
    branches.push(branch)
  }
  console.log(`✓ ${branches.length} branches`)

  // ── Users ─────────────────────────────────────────────
  const hash = await bcrypt.hash('password123', 10)

  const userDefs = [
    { email: 'admin@ebright.my', name: 'Super Admin', role: 'SUPER_ADMIN' as const, branchIdx: null },
    { email: 'agency@ebright.my', name: 'Agency Admin', role: 'AGENCY_ADMIN' as const, branchIdx: null },
    { email: 'bm.kl@ebright.my', name: 'Lim Wei Ming', role: 'BRANCH_MANAGER' as const, branchIdx: 0 },
    { email: 'bm.pj@ebright.my', name: 'Sarah Tan', role: 'BRANCH_MANAGER' as const, branchIdx: 1 },
    { email: 'bm.subang@ebright.my', name: 'Raj Kumar', role: 'BRANCH_MANAGER' as const, branchIdx: 2 },
    { email: 'staff1@ebright.my', name: 'Nurul Ain', role: 'BRANCH_STAFF' as const, branchIdx: 0 },
    { email: 'staff2@ebright.my', name: 'Hafizuddin', role: 'BRANCH_STAFF' as const, branchIdx: 0 },
    { email: 'staff3@ebright.my', name: 'Priya Nair', role: 'BRANCH_STAFF' as const, branchIdx: 1 },
    { email: 'staff4@ebright.my', name: 'Chen Wei', role: 'BRANCH_STAFF' as const, branchIdx: 2 },
  ]

  const users: { id: string; email: string; name: string | null }[] = []
  for (const u of userDefs) {
    const existing = await prisma.crm_auth_user.findUnique({ where: { email: u.email } })
    if (existing) { users.push(existing); continue }
    const user = await prisma.crm_auth_user.create({
      data: { id: randomUUID(), email: u.email, name: u.name, emailVerified: true },
    })
    // Create password account
    await prisma.crm_auth_account.create({
      data: {
        id: randomUUID(), userId: user.id,
        accountId: user.id, providerId: 'credential', password: hash,
      },
    })
    users.push(user)
  }

  // Link users to branches
  for (let i = 0; i < userDefs.length; i++) {
    const def = userDefs[i]
    const user = users[i]
    if (def.branchIdx !== null) {
      await prisma.crm_user_branch.upsert({
        where: { userId_branchId: { userId: user.id, branchId: branches[def.branchIdx].id } },
        update: {},
        create: { id: randomUUID(), userId: user.id, branchId: branches[def.branchIdx].id, tenantId, role: def.role },
      })
    } else {
      // Super/Agency admin: link to all branches
      for (const branch of branches) {
        await prisma.crm_user_branch.upsert({
          where: { userId_branchId: { userId: user.id, branchId: branch.id } },
          update: {},
          create: { id: randomUUID(), userId: user.id, branchId: branch.id, tenantId, role: def.role },
        })
      }
    }
  }
  console.log(`✓ ${users.length} users`)

  // ── Lead Sources ──────────────────────────────────────
  const leadSourceNames = [
    'Meta','TikTok','Website (Conversion)','Roadshow',
    'Self-Generated','Walk-In','Website (Organic)','Others',
  ]
  const leadSources: { id: string; name: string }[] = []
  for (const name of leadSourceNames) {
    const existing = await prisma.crm_lead_source.findFirst({ where: { tenantId, name } })
    if (existing) { leadSources.push(existing); continue }
    const ls = await prisma.crm_lead_source.create({ data: { id: randomUUID(), tenantId, name } })
    leadSources.push(ls)
  }
  console.log(`✓ ${leadSources.length} lead sources`)

  // ── Pipeline + 16 Stages ─────────────────────────────
  const stageDefs = [
    { name: 'New Lead', shortCode: 'NL', color: 'blue', order: 1 },
    { name: 'Follow-Up 1st Attempt', shortCode: 'FU1', color: 'sky', order: 2 },
    { name: 'Follow-Up 2nd Attempt', shortCode: 'FU2', color: 'cyan', order: 3 },
    { name: 'Follow-Up 3rd Attempt', shortCode: 'FU3', color: 'teal', order: 4 },
    { name: 'Reschedule', shortCode: 'RSD', color: 'amber', order: 5 },
    { name: 'Confirmed for Trial', shortCode: 'CT', color: 'lime', order: 6 },
    { name: 'Confirmed No-Show', shortCode: 'CNS', color: 'orange', order: 7 },
    { name: 'Show-Up', shortCode: 'SU', color: 'emerald', order: 8 },
    { name: 'Show-Up No-Enroll', shortCode: 'SNE', color: 'yellow', order: 9 },
    { name: 'Enrolled', shortCode: 'ENR', color: 'green', order: 10 },
    { name: 'Unresponsive-Week 1', shortCode: 'UR-w1', color: 'zinc', order: 11 },
    { name: 'Unresponsive-Week 2', shortCode: 'UR-w2', color: 'stone', order: 12 },
    { name: 'Unresponsive-Week 3', shortCode: 'UR-w3', color: 'neutral', order: 13 },
    { name: 'Cold Lead', shortCode: 'CLD', color: 'slate', order: 14 },
    { name: 'Do Not Disturb', shortCode: 'DND', color: 'red', order: 15 },
    { name: 'Buffer (For OD Use)', shortCode: 'BUF', color: 'gray', order: 16 },
  ]

  const stages: { id: string; shortCode: string }[] = []
  for (const branch of branches) {
    const existingPipeline = await prisma.crm_pipeline.findFirst({ where: { tenantId, branchId: branch.id, name: 'Main Pipeline' } })
    const pipeline = existingPipeline ?? await prisma.crm_pipeline.create({
      data: { id: randomUUID(), tenantId, branchId: branch.id, name: 'Main Pipeline' },
    })

    for (const s of stageDefs) {
      const existing = await prisma.crm_stage.findFirst({ where: { tenantId, pipelineId: pipeline.id, shortCode: s.shortCode } })
      if (existing) { if (branch === branches[0]) stages.push(existing); continue }
      const stage = await prisma.crm_stage.create({
        data: { id: randomUUID(), tenantId, pipelineId: pipeline.id, ...s },
      })
      if (branch === branches[0]) stages.push(stage)
    }
  }
  console.log(`✓ 16 pipeline stages × ${branches.length} branches`)

  // ── Tags ────────────────────────────────────────────
  const tagDefs = [
    { name: 'Hot Lead', color: '#ef4444' },
    { name: 'Follow-Up Needed', color: '#f97316' },
    { name: 'Trial Booked', color: '#22c55e' },
    { name: 'Referred', color: '#8b5cf6' },
    { name: 'Corporate', color: '#3b82f6' },
    { name: 'VIP', color: '#eab308' },
  ]
  for (const t of tagDefs) {
    const existing = await prisma.crm_tag.findFirst({ where: { tenantId, name: t.name } })
    if (!existing) {
      await prisma.crm_tag.create({ data: { id: randomUUID(), tenantId, ...t } })
    }
  }
  console.log(`✓ ${tagDefs.length} tags`)

  // ── Custom Values ────────────────────────────────────
  const customValues = [
    { key: 'branch_address', value: '50450 Kuala Lumpur, Malaysia', scope: 'TENANT' as const, scopeId: null },
    { key: 'branch_phone', value: '+603-XXXX-XXXX', scope: 'TENANT' as const, scopeId: null },
    { key: 'company_name', value: 'Ebright OSC', scope: 'TENANT' as const, scopeId: null },
    { key: 'whatsapp_greeting', value: 'Hi {{contact.first_name}}! Thank you for your interest in Ebright OSC.', scope: 'TENANT' as const, scopeId: null },
  ]
  for (const cv of customValues) {
    await prisma.crm_custom_value.upsert({
      where: { tenantId_scope_scopeId_key: { tenantId, scope: cv.scope, scopeId: cv.scopeId ?? '', key: cv.key } },
      update: { value: cv.value },
      create: { id: randomUUID(), tenantId, key: cv.key, value: cv.value, scope: cv.scope },
    })
  }

  // ── Message Templates ────────────────────────────────
  const templates = [
    {
      name: 'Welcome Message (WhatsApp)',
      channel: 'WHATSAPP' as const,
      body: 'Hi {{contact.first_name}}! 👋 Thank you for your interest in Ebright OSC. We\'d love to schedule a trial class for {{contact.child_name_1}}. When would be a good time? 😊',
    },
    {
      name: 'Follow-Up (WhatsApp)',
      channel: 'WHATSAPP' as const,
      body: 'Hi {{contact.first_name}}, just checking in! We haven\'t heard back from you. We have trial slots available this {{contact.preferred_trial_day}}. Shall we book one for {{contact.child_name_1}}?',
    },
    {
      name: 'Trial Confirmation (Email)',
      channel: 'EMAIL' as const,
      subject: 'Your Trial Class is Confirmed! 🎉',
      body: '<p>Hi {{contact.first_name}},</p><p>We\'re excited to confirm {{contact.child_name_1}}\'s trial class at Ebright OSC. Please arrive 10 minutes early. See you soon!</p>',
    },
  ]
  for (const t of templates) {
    const existing = await prisma.crm_message_template.findFirst({ where: { tenantId, name: t.name } })
    if (!existing) {
      await prisma.crm_message_template.create({
        data: { id: randomUUID(), tenantId, name: t.name, channel: t.channel, body: t.body, subject: (t as { subject?: string }).subject },
      })
    }
  }

  // ── 80 Demo Contacts + Opportunities ──────────────────
  const bmUsers = users.filter((_, i) => [2, 3, 4].includes(i))

  let created = 0
  for (let i = 0; i < 80; i++) {
    const branch = branches[i % 3]
    const assignedUser = bmUsers[i % 3]
    const leadSource = leadSources[rand(0, leadSources.length - 1)]
    const stage = stages[rand(0, stages.length - 1)]
    const firstName = pick(MY_NAMES_FIRST)
    const lastName = pick(MY_NAMES_LAST)
    const phone = `+601${rand(1, 9)}${rand(1000000, 9999999)}`
    const email = `${firstName.toLowerCase()}.${i}@demo.com`
    const childName = pick(CHILD_NAMES)
    const childAge = `${rand(3, 8)} years`
    const daysAgo = rand(0, 90)
    const createdAt = new Date(Date.now() - daysAgo * 86400000)

    const existing = await prisma.crm_contact.findFirst({ where: { tenantId, phone } })
    if (existing) continue

    const contact = await prisma.crm_contact.create({
      data: {
        id: randomUUID(), tenantId, branchId: branch.id,
        firstName, lastName, email, phone,
        leadSourceId: leadSource.id,
        assignedUserId: assignedUser.id,
        preferredBranchId: branch.id,
        preferredTrialDay: pick(TRIAL_DAYS),
        childName1: childName, childAge1: childAge,
        enrolledPackage: stage.shortCode === 'ENR' ? pick(PACKAGES) : undefined,
        createdAt, updatedAt: createdAt,
      },
    })

    // Create opportunity in the pipeline
    const pipeline = await prisma.crm_pipeline.findFirst({ where: { tenantId, branchId: branch.id } })
    if (pipeline) {
      const stageInBranch = await prisma.crm_stage.findFirst({
        where: { tenantId, pipelineId: pipeline.id, shortCode: stage.shortCode },
      })
      if (stageInBranch) {
        const oppValue = stage.shortCode === 'ENR' ? rand(3800, 7500) : 0
        const opp = await prisma.crm_opportunity.create({
          data: {
            id: randomUUID(), tenantId, branchId: branch.id,
            contactId: contact.id, pipelineId: pipeline.id,
            stageId: stageInBranch.id,
            value: oppValue,
            assignedUserId: assignedUser.id,
            lastStageChangeAt: new Date(createdAt.getTime() + rand(0, 48) * 3600000),
            createdAt, updatedAt: createdAt,
          },
        })
        await prisma.crm_stage_history.create({
          data: {
            id: randomUUID(), tenantId,
            opportunityId: opp.id, toStageId: stageInBranch.id,
            changedByUserId: assignedUser.id, changedAt: createdAt,
          },
        })
      }
    }
    created++
  }
  console.log(`✓ ${created} demo contacts + opportunities`)

  // ── Pre-built Welcome Automation ─────────────────────
  const pipeline0 = await prisma.crm_pipeline.findFirst({ where: { tenantId, branchId: branches[0].id } })
  const existingAuto = await prisma.crm_automation.findFirst({ where: { tenantId, name: 'Welcome New Lead' } })
  if (!existingAuto && pipeline0) {
    await prisma.crm_automation.create({
      data: {
        id: randomUUID(), tenantId, branchId: branches[0].id,
        name: 'Welcome New Lead',
        triggerType: 'NEW_LEAD',
        triggerConfig: {},
        enabled: true,
        graph: {
          nodes: [
            { id: 'trigger-1', type: 'trigger', position: { x: 200, y: 50 }, data: { label: 'New Lead Created', triggerType: 'NEW_LEAD' } },
            { id: 'action-1', type: 'action', position: { x: 200, y: 200 }, data: { label: 'Send WhatsApp', actionType: 'sendWhatsApp', config: { body: 'Hi {{contact.first_name}}! Thank you for your interest in Ebright OSC. We\'d love to book a trial for {{contact.child_name_1}}!' } } },
            { id: 'delay-1', type: 'delay', position: { x: 200, y: 350 }, data: { label: 'Wait 1 Day', amount: 1440, unit: 'minutes' } },
            { id: 'action-2', type: 'action', position: { x: 200, y: 500 }, data: { label: 'Send Follow-Up Email', actionType: 'sendEmail', config: { subject: 'Following up on your enquiry', body: 'Hi {{contact.first_name}}, just checking in! Our trial slots are filling up fast. Let us know if you\'d like to book one for {{contact.child_name_1}}.' } } },
          ],
          edges: [
            { id: 'e1', source: 'trigger-1', target: 'action-1' },
            { id: 'e2', source: 'action-1', target: 'delay-1' },
            { id: 'e3', source: 'delay-1', target: 'action-2' },
          ],
        },
      },
    })
    console.log('✓ Pre-built automation: Welcome New Lead')
  }

  console.log('\n✅ Seed complete!')
  console.log('\n📧 Login credentials:')
  console.log('   Super Admin:   admin@ebright.my    / password123')
  console.log('   Agency Admin:  agency@ebright.my   / password123')
  console.log('   BM (KL):       bm.kl@ebright.my    / password123')
  console.log('   BM (PJ):       bm.pj@ebright.my    / password123')
  console.log('   BM (Subang):   bm.subang@ebright.my / password123')
}

// ============================================================
// TICKETING MODULE SEED
// ============================================================

async function seedTicketing() {
  console.log('\n🎫 Seeding ticketing module…')

  // ── Resolve tenant ─────────────────────────────────────────────────────────
  const tenant = await prisma.crm_tenant.findUnique({ where: { slug: 'ebright-demo' } })
  if (!tenant) throw new Error('ebright-demo tenant not found — run the CRM seed first.')
  const tenantId = tenant.id

  // ── tkt_platforms ──────────────────────────────────────────────────────────
  const platformDefs = [
    { name: 'Aone',           slug: 'aone',           code: '01', accent_color: '#dc2626' },
    { name: 'GHL',            slug: 'ghl',            code: '02', accent_color: '#2563eb' },
    { name: 'Process Street', slug: 'process-street', code: '03', accent_color: '#7c3aed' },
    { name: 'ClickUp',        slug: 'clickup',        code: '04', accent_color: '#0891b2' },
    { name: 'Other',          slug: 'other',          code: '05', accent_color: '#6b7280' },
  ]

  const platforms: { id: string; name: string; slug: string; code: string }[] = []
  for (const p of platformDefs) {
    const platform = await prisma.tkt_platform.upsert({
      where: { tenant_id_slug: { tenant_id: tenantId, slug: p.slug } },
      update: { name: p.name, code: p.code, accent_color: p.accent_color },
      create: { tenant_id: tenantId, name: p.name, slug: p.slug, code: p.code, accent_color: p.accent_color },
    })
    platforms.push(platform)
  }
  console.log(`✓ ${platforms.length} tkt_platforms`)

  // ── tkt_branches ───────────────────────────────────────────────────────────
  const branchDefs = [
    { branch_number: '01', code: 'AMP', name: 'Ampang' },
    { branch_number: '02', code: 'ACR', name: 'Anggun City Rawang' },
    { branch_number: '03', code: 'BGI', name: 'Bangi' },
    { branch_number: '04', code: 'BCV', name: 'Batu Caves' },
    { branch_number: '05', code: 'BKJ', name: 'Bukit Jalil' },
    { branch_number: '06', code: 'CHR', name: 'Cheras' },
    { branch_number: '07', code: 'CYJ', name: 'Cyberjaya' },
    { branch_number: '08', code: 'DMS', name: 'Damansara' },
    { branch_number: '09', code: 'GMB', name: 'Gombak' },
    { branch_number: '10', code: 'KJG', name: 'Kajang' },
    { branch_number: '11', code: 'KLM', name: 'Kelang Lama' },
    { branch_number: '12', code: 'KPG', name: 'Kepong' },
    { branch_number: '13', code: 'KRM', name: 'Keramat' },
    { branch_number: '14', code: 'KLG', name: 'Klang' },
    { branch_number: '15', code: 'KDM', name: 'Kota Damansara' },
    { branch_number: '16', code: 'KCL', name: 'Kuchai Lama' },
    { branch_number: '17', code: 'B17', name: 'Branch-17' },
    { branch_number: '18', code: 'MJG', name: 'Manjung' },
    { branch_number: '19', code: 'PDI', name: 'Pandan Indah' },
    { branch_number: '20', code: 'PJY', name: 'Petaling Jaya' },
    { branch_number: '21', code: 'PCG', name: 'Puchong' },
    { branch_number: '22', code: 'RWG', name: 'Rawang' },
    { branch_number: '23', code: 'SLY', name: 'Selayang' },
    { branch_number: '24', code: 'SMY', name: 'Semenyih' },
    { branch_number: '25', code: 'B25', name: 'Branch-25' },
    { branch_number: '26', code: 'TSG', name: 'Taman Sri Gombak' },
  ]

  const tktBranches: { id: string; name: string; branch_number: string; code: string }[] = []
  for (const b of branchDefs) {
    const branch = await prisma.tkt_branch.upsert({
      where: { tenant_id_branch_number: { tenant_id: tenantId, branch_number: b.branch_number } },
      update: { name: b.name, code: b.code },
      create: { tenant_id: tenantId, name: b.name, code: b.code, branch_number: b.branch_number },
    })
    tktBranches.push(branch)
  }
  console.log(`✓ ${tktBranches.length} tkt_branches`)

  // ── tkt_user_profiles for existing CRM users ───────────────────────────────
  const crmUsers = await prisma.crm_auth_user.findMany({ select: { id: true, email: true } })

  for (const u of crmUsers) {
    const role = u.email === 'admin@ebright.my' ? 'super_admin' : 'user'
    await prisma.tkt_user_profile.upsert({
      where: { user_id: u.id },
      update: { role },
      create: { user_id: u.id, tenant_id: tenantId, role },
    })
  }
  console.log(`✓ tkt_user_profiles for ${crmUsers.length} existing CRM users`)

  // ── Platform admin users ───────────────────────────────────────────────────
  // Create crm_auth_user + account + tkt_user_profile for each platform admin.
  const adminHash = await bcrypt.hash('admin123', 12)

  const platformAdminDefs = [
    { email: 'admin.aone@ebright.my',    name: 'Aone Admin',           slug: 'aone'           },
    { email: 'admin.ghl@ebright.my',     name: 'GHL Admin',            slug: 'ghl'            },
    { email: 'admin.ps@ebright.my',      name: 'Process Street Admin', slug: 'process-street' },
    { email: 'admin.clickup@ebright.my', name: 'ClickUp Admin',        slug: 'clickup'        },
    { email: 'admin.other@ebright.my',   name: 'Other Admin',          slug: 'other'          },
  ]

  for (const def of platformAdminDefs) {
    // 1. Ensure crm_auth_user exists
    let authUser = await prisma.crm_auth_user.findUnique({ where: { email: def.email } })
    if (!authUser) {
      authUser = await prisma.crm_auth_user.create({
        data: { id: randomUUID(), email: def.email, name: def.name, emailVerified: true },
      })
      await prisma.crm_auth_account.create({
        data: {
          id: randomUUID(), userId: authUser.id,
          accountId: authUser.id, providerId: 'credential', password: adminHash,
        },
      })
    }

    // 2. Ensure tkt_user_profile with platform_admin role
    await prisma.tkt_user_profile.upsert({
      where: { user_id: authUser.id },
      update: { role: 'platform_admin' },
      create: { user_id: authUser.id, tenant_id: tenantId, role: 'platform_admin' },
    })

    // 3. Link to the correct platform
    const platform = platforms.find((p) => p.slug === def.slug)
    if (platform) {
      await prisma.tkt_user_platform.upsert({
        where: { user_id_platform_id: { user_id: authUser.id, platform_id: platform.id } },
        update: {},
        create: { user_id: authUser.id, platform_id: platform.id },
      })
    }
  }
  console.log(`✓ ${platformAdminDefs.length} platform admin users`)

  // ── 10 regular users with Malaysian names ──────────────────────────────────
  const regularUserHash = await bcrypt.hash('password123', 10)

  const regularUserDefs = [
    { email: 'nurul.hidayah@ebright.my',  name: 'Nurul Hidayah binti Aziz',      branchIdx: 0  },
    { email: 'ahmad.faris@ebright.my',    name: 'Ahmad Faris bin Roslan',         branchIdx: 1  },
    { email: 'siti.aisyah@ebright.my',    name: 'Siti Aisyah binti Hamid',        branchIdx: 2  },
    { email: 'muhammad.izzat@ebright.my', name: 'Muhammad Izzat bin Zainuddin',   branchIdx: 3  },
    { email: 'nur.fatin@ebright.my',      name: 'Nur Fatin binti Othman',         branchIdx: 4  },
    { email: 'haziq.asyraf@ebright.my',   name: 'Haziq Asyraf bin Mahmud',        branchIdx: 5  },
    { email: 'farah.adilah@ebright.my',   name: 'Farah Adilah binti Kamarudin',   branchIdx: 6  },
    { email: 'izzuddin.zaki@ebright.my',  name: 'Izzuddin Zaki bin Saad',         branchIdx: 7  },
    { email: 'nabilah.husna@ebright.my',  name: 'Nabilah Husna binti Mohd Noor',  branchIdx: 8  },
    { email: 'ariff.danial@ebright.my',   name: 'Ariff Danial bin Che Hassan',    branchIdx: 9  },
  ]

  const regularTktUsers: { id: string; email: string; name: string | null }[] = []
  for (const def of regularUserDefs) {
    let authUser = await prisma.crm_auth_user.findUnique({ where: { email: def.email } })
    if (!authUser) {
      authUser = await prisma.crm_auth_user.create({
        data: { id: randomUUID(), email: def.email, name: def.name, emailVerified: true },
      })
      await prisma.crm_auth_account.create({
        data: {
          id: randomUUID(), userId: authUser.id,
          accountId: authUser.id, providerId: 'credential', password: regularUserHash,
        },
      })
    }

    await prisma.tkt_user_profile.upsert({
      where: { user_id: authUser.id },
      update: { role: 'user' },
      create: { user_id: authUser.id, tenant_id: tenantId, role: 'user' },
    })

    // Assign to a branch
    const branch = tktBranches[def.branchIdx]
    await prisma.tkt_user_branch.upsert({
      where: { user_id_branch_id: { user_id: authUser.id, branch_id: branch.id } },
      update: {},
      create: { user_id: authUser.id, branch_id: branch.id },
    })

    regularTktUsers.push(authUser)
  }
  console.log(`✓ ${regularTktUsers.length} regular tkt users`)

  // ── 30 sample tickets ──────────────────────────────────────────────────────
  // Fetch the super_admin user for assigned_admin_id
  const superAdminUser = await prisma.crm_auth_user.findUnique({ where: { email: 'admin@ebright.my' } })
  const superAdminId = superAdminUser?.id ?? regularTktUsers[0].id

  type TicketStatus = 'received' | 'in_progress' | 'complete' | 'rejected'

  interface TicketDef {
    platformSlug: string
    subType: string
    fields: Record<string, unknown>
    status: TicketStatus
    userIdx: number
    branchIdx: number
    daysAgo: number
    adminRemark?: string
    rejectionReason?: string
  }

  const ticketDefs: TicketDef[] = [
    // Aone tickets
    {
      platformSlug: 'aone', subType: 'freeze_student', status: 'received',
      fields: { studentName: 'Aryan Hariz', startDate: '2026-04-20', endDate: '2026-05-20', reason: 'Family trip abroad for a month' },
      userIdx: 0, branchIdx: 0, daysAgo: 1,
    },
    {
      platformSlug: 'aone', subType: 'archive_student', status: 'in_progress',
      fields: { studentName: 'Layla Sofea', reason: 'Student has graduated and completed all programmes' },
      userIdx: 1, branchIdx: 1, daysAgo: 3,
    },
    {
      platformSlug: 'aone', subType: 'delete_invoice', status: 'complete',
      fields: { studentName: 'Rayyan Hakimi', invoiceNumber: 'INV-2026-0341', reason: 'Duplicate invoice created in error' },
      userIdx: 2, branchIdx: 2, daysAgo: 5, adminRemark: 'Invoice deleted. Please confirm on your end.',
    },
    {
      platformSlug: 'aone', subType: 'login_issue', status: 'rejected',
      fields: { remarks: 'Cannot log in since yesterday afternoon. Password reset not working.' },
      userIdx: 3, branchIdx: 3, daysAgo: 10,
      adminRemark: 'Issue is on the user device. Please clear browser cache.',
      rejectionReason: 'Not a system issue. User device configuration problem.',
    },
    {
      platformSlug: 'aone', subType: 'others', status: 'received',
      fields: { remarks: 'Monthly report dashboard showing wrong figures for March 2026' },
      userIdx: 4, branchIdx: 4, daysAgo: 2,
    },
    {
      platformSlug: 'aone', subType: 'freeze_student', status: 'complete',
      fields: { studentName: 'Idris Qayyum', startDate: '2026-03-01', endDate: '2026-03-31', reason: 'Medical leave — dengue fever' },
      userIdx: 5, branchIdx: 5, daysAgo: 20, adminRemark: 'Freeze applied. Account will reactivate on 1 April 2026.',
    },
    {
      platformSlug: 'aone', subType: 'archive_student', status: 'in_progress',
      fields: { studentName: 'Hana Batrisyia', reason: 'Student relocated to Johor Bahru permanently' },
      userIdx: 6, branchIdx: 6, daysAgo: 4,
    },
    {
      platformSlug: 'aone', subType: 'delete_invoice', status: 'received',
      fields: { studentName: 'Omar Faris', invoiceNumber: 'INV-2026-0512', reason: 'Wrong amount billed — should be RM 3800 not RM 5200' },
      userIdx: 7, branchIdx: 7, daysAgo: 0,
    },

    // GHL tickets
    {
      platformSlug: 'ghl', subType: 'leads', status: 'received',
      fields: { remarks: 'Leads from Meta campaign not appearing in GHL pipeline since 15 April' },
      userIdx: 8, branchIdx: 8, daysAgo: 2,
    },
    {
      platformSlug: 'ghl', subType: 'tally', status: 'in_progress',
      fields: { remarks: 'Tally form submission not triggering GHL automation workflow' },
      userIdx: 9, branchIdx: 9, daysAgo: 5,
    },
    {
      platformSlug: 'ghl', subType: 'organizing_leads', status: 'complete',
      fields: { remarks: 'Need help tagging and segmenting 200 cold leads from Q1 2026' },
      userIdx: 0, branchIdx: 10, daysAgo: 14, adminRemark: 'Leads have been tagged. Check the "Q1-Cold" tag in GHL.',
    },
    {
      platformSlug: 'ghl', subType: 'booking', status: 'rejected',
      fields: { remarks: 'Booking calendar not syncing with Google Calendar — last 3 appointments missing' },
      userIdx: 1, branchIdx: 11, daysAgo: 8,
      rejectionReason: 'Google Calendar permissions were revoked. Please reconnect the integration in GHL settings.',
    },
    {
      platformSlug: 'ghl', subType: 'workflow', status: 'received',
      fields: { remarks: 'Follow-up sequence emails not sending after 48-hour delay node' },
      userIdx: 2, branchIdx: 12, daysAgo: 1,
    },
    {
      platformSlug: 'ghl', subType: 'others', status: 'complete',
      fields: { remarks: 'Need GHL dashboard access for new branch manager Sarah Tan (sarah@ebright.my)' },
      userIdx: 3, branchIdx: 13, daysAgo: 18, adminRemark: 'Access granted. Sarah can log in using her email.',
    },
    {
      platformSlug: 'ghl', subType: 'leads', status: 'in_progress',
      fields: { remarks: 'Duplicate lead entries appearing — same contact created multiple times from website form' },
      userIdx: 4, branchIdx: 14, daysAgo: 6,
    },
    {
      platformSlug: 'ghl', subType: 'booking', status: 'received',
      fields: { remarks: 'Trial class booking form showing wrong time slots — needs to reflect April schedule' },
      userIdx: 5, branchIdx: 15, daysAgo: 0,
    },

    // Process Street tickets
    {
      platformSlug: 'process-street', subType: 'extend', status: 'received',
      fields: { remarks: 'Onboarding checklist for branch Kepong is 60% complete — need 2 more weeks to finish' },
      userIdx: 6, branchIdx: 16, daysAgo: 3,
    },
    {
      platformSlug: 'process-street', subType: 'others', status: 'in_progress',
      fields: { remarks: 'Cannot access Process Street account — getting "workspace suspended" error' },
      userIdx: 7, branchIdx: 17, daysAgo: 7,
    },
    {
      platformSlug: 'process-street', subType: 'extend', status: 'complete',
      fields: { remarks: 'Monthly compliance audit checklist deadline extension — original: 10 Apr, request: 20 Apr' },
      userIdx: 8, branchIdx: 18, daysAgo: 15, adminRemark: 'Extended to 20 April. Please complete before then.',
    },
    {
      platformSlug: 'process-street', subType: 'others', status: 'rejected',
      fields: { remarks: 'Request to create a new custom template for staff performance review' },
      userIdx: 9, branchIdx: 19, daysAgo: 12,
      rejectionReason: 'Custom templates are out of scope for the support team. Please raise with your branch manager.',
    },
    {
      platformSlug: 'process-street', subType: 'extend', status: 'received',
      fields: { remarks: 'Staff induction process for 3 new hires — need extension to complete module 3 and 4' },
      userIdx: 0, branchIdx: 20, daysAgo: 1,
    },
    {
      platformSlug: 'process-street', subType: 'others', status: 'complete',
      fields: { remarks: 'Need read-only access for branch manager to review team checklists without editing' },
      userIdx: 1, branchIdx: 21, daysAgo: 25, adminRemark: 'Read-only access configured for the Rawang branch manager.',
    },

    // ClickUp tickets
    {
      platformSlug: 'clickup', subType: 'missing', status: 'received',
      fields: { remarks: 'Tasks from last week sprint are not showing in the board view — only visible in list view' },
      userIdx: 2, branchIdx: 22, daysAgo: 2,
    },
    {
      platformSlug: 'clickup', subType: 'duplicate', status: 'in_progress',
      fields: { remarks: '15 tasks duplicated after the last sync — they appear twice with identical names' },
      userIdx: 3, branchIdx: 23, daysAgo: 4,
    },
    {
      platformSlug: 'clickup', subType: 'linkage', status: 'complete',
      fields: { remarks: 'Dependencies between tasks not showing — linked tasks no longer show as blocked' },
      userIdx: 4, branchIdx: 24, daysAgo: 10, adminRemark: 'Task linkage restored. Dependency view re-enabled in space settings.',
    },
    {
      platformSlug: 'clickup', subType: 'others', status: 'rejected',
      fields: { remarks: 'Request to upgrade ClickUp plan to include time tracking and reporting features' },
      userIdx: 5, branchIdx: 25, daysAgo: 9,
      rejectionReason: 'Plan upgrades require approval from management. Please submit a formal request through the usual channel.',
    },
    {
      platformSlug: 'clickup', subType: 'missing', status: 'received',
      fields: { remarks: 'Entire Semenyih branch workspace is missing from my ClickUp sidebar after password change' },
      userIdx: 6, branchIdx: 0, daysAgo: 0,
    },
    {
      platformSlug: 'clickup', subType: 'duplicate', status: 'complete',
      fields: { remarks: 'Automation rule ran twice and created 30 duplicate subtasks under Q2 planning project' },
      userIdx: 7, branchIdx: 1, daysAgo: 30, adminRemark: 'Duplicates removed and automation rule corrected. Please verify.',
    },

    // Other tickets
    {
      platformSlug: 'other', subType: 'others', status: 'received',
      fields: { remarks: 'Need access to the staff portal for new team member — joining on 20 April 2026' },
      userIdx: 8, branchIdx: 2, daysAgo: 1,
    },
    {
      platformSlug: 'other', subType: 'others', status: 'complete',
      fields: { remarks: 'Request to reset 2FA for staff member who lost their phone — Nurul Ain, KL branch' },
      userIdx: 9, branchIdx: 3, daysAgo: 22, adminRemark: '2FA has been reset. Staff member can set it up again on next login.',
    },
  ]

  let ticketCount = 0
  for (const def of ticketDefs) {
    const platform = platforms.find((p) => p.slug === def.platformSlug)
    if (!platform) continue

    const tktBranch = tktBranches[def.branchIdx]
    const tktUser = regularTktUsers[def.userIdx % regularTktUsers.length]

    // Generate ticket number: {branchCode}{platformCode}-{YYMM}{seq:04}
    const createdAt = new Date(Date.now() - def.daysAgo * 86400000)
    const period = `${String(createdAt.getFullYear()).slice(2)}${String(createdAt.getMonth() + 1).padStart(2, '0')}`

    // Atomic counter upsert
    let counter = await prisma.tkt_counter.findUnique({
      where: { tenant_id_period_branch_id_platform_id: {
        tenant_id: tenantId, period, branch_id: tktBranch.id, platform_id: platform.id,
      }},
    })

    if (!counter) {
      counter = await prisma.tkt_counter.create({
        data: { tenant_id: tenantId, period, branch_id: tktBranch.id, platform_id: platform.id, value: 1 },
      })
    } else {
      counter = await prisma.tkt_counter.update({
        where: { tenant_id_period_branch_id_platform_id: {
          tenant_id: tenantId, period, branch_id: tktBranch.id, platform_id: platform.id,
        }},
        data: { value: { increment: 1 } },
      })
    }

    const seq = String(counter.value).padStart(4, '0')
    const ticketNumber = `${tktBranch.code}${platform.code}-${period}${seq}`

    // Check for duplicate
    const existing = await prisma.tkt_ticket.findUnique({
      where: { tenant_id_ticket_number: { tenant_id: tenantId, ticket_number: ticketNumber } },
    })
    if (existing) continue

    // Determine completed_at / visible_until
    const completedAt =
      def.status === 'complete' || def.status === 'rejected'
        ? new Date(createdAt.getTime() + 24 * 3600000)
        : null
    const visibleUntil = completedAt
      ? new Date(completedAt.getTime() + 7 * 86400000)
      : null

    // issue_context = human-readable summary
    const issueContext = def.subType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

    const ticket = await prisma.tkt_ticket.create({
      data: {
        tenant_id:         tenantId,
        ticket_number:     ticketNumber,
        branch_id:         tktBranch.id,
        platform_id:       platform.id,
        user_id:           tktUser.id,
        issue_context:     issueContext,
        sub_type:          def.subType,
        fields:            def.fields,
        status:            def.status,
        admin_remark:      def.adminRemark ?? null,
        rejection_reason:  def.rejectionReason ?? null,
        assigned_admin_id: def.status !== 'received' ? superAdminId : null,
        completed_at:      completedAt,
        visible_until:     visibleUntil,
        created_at:        createdAt,
        updated_at:        createdAt,
      },
    })

    // Create initial event: ticket received
    await prisma.tkt_ticket_event.create({
      data: {
        tenant_id: tenantId,
        ticket_id: ticket.id,
        actor_id:  tktUser.id,
        type:      'status_change',
        from_value: null,
        to_value:  'received',
        payload:   { note: 'Ticket submitted' },
        created_at: createdAt,
      },
    })

    // Status-change event if not still received
    if (def.status !== 'received') {
      const eventAt = new Date(createdAt.getTime() + 2 * 3600000)
      await prisma.tkt_ticket_event.create({
        data: {
          tenant_id:  tenantId,
          ticket_id:  ticket.id,
          actor_id:   superAdminId,
          type:       'status_change',
          from_value: 'received',
          to_value:   def.status,
          payload:    {
            adminRemark:      def.adminRemark ?? null,
            rejectionReason:  def.rejectionReason ?? null,
          },
          created_at: eventAt,
        },
      })
    }

    ticketCount++
  }
  console.log(`✓ ${ticketCount} sample tickets`)
  console.log('⚠️  TODO: Rename branches 17 and 25 before going live.')
}

main()
  .then(() => seedTicketing())
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

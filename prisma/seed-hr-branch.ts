/**
 * Create an HR "branch" with a Recruitment pipeline (6 hiring stages) and an
 * HR admin account linked to it at BRANCH_MANAGER level.
 *
 * Idempotent — safe to re-run. Password is bcrypt so Better Auth (which we
 * configured to use bcryptjs) can verify logins.
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const HR_BRANCH_NAME = 'HR'
const RECRUITMENT_PIPELINE_NAME = 'Recruitment'

const RECRUITMENT_STAGES = [
  { name: 'Candidate',            shortCode: 'CD',  color: 'slate'   },
  { name: 'Intern',               shortCode: 'INT', color: 'blue'    },
  { name: 'Full Time',            shortCode: 'FT',  color: 'emerald' },
  { name: 'Part Timer',           shortCode: 'PT',  color: 'amber'   },
  { name: 'Buffer Resume',        shortCode: 'BR',  color: 'indigo'  },
  { name: 'Resume Shortlisted',   shortCode: 'RS',  color: 'rose'    },
]

const HR_USER_EMAIL = 'admin-hr@ebright.my'
const HR_USER_NAME  = 'HR Admin'
const HR_USER_PASSWORD = 'admin123'

async function main() {
  const tenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  if (!tenant) throw new Error('ebright-demo tenant not found')
  const tenantId = tenant.id

  // 1. HR branch
  let hrBranch = await prisma.crm_branch.findFirst({
    where: { tenantId, name: HR_BRANCH_NAME },
  })
  if (!hrBranch) {
    hrBranch = await prisma.crm_branch.create({
      data: {
        tenantId,
        name: HR_BRANCH_NAME,
        timezone: 'Asia/Kuala_Lumpur',
      },
    })
    console.log(`  + created HR branch (${hrBranch.id})`)
  } else {
    console.log(`  ✓ HR branch already exists (${hrBranch.id})`)
  }

  // 2. Recruitment pipeline — remove any previous "Main Pipeline" on HR branch
  const defaultPipeline = await prisma.crm_pipeline.findFirst({
    where: { tenantId, branchId: hrBranch.id, name: 'Main Pipeline' },
    include: { stages: { include: { opportunities: { select: { id: true } } } } },
  })
  if (defaultPipeline) {
    const hasData = defaultPipeline.stages.some((s) => s.opportunities.length > 0)
    if (!hasData) {
      await prisma.crm_stage.deleteMany({ where: { pipelineId: defaultPipeline.id } })
      await prisma.crm_pipeline.delete({ where: { id: defaultPipeline.id } })
      console.log(`  ✂ removed empty default pipeline on HR branch`)
    }
  }

  let pipeline = await prisma.crm_pipeline.findFirst({
    where: { tenantId, branchId: hrBranch.id, name: RECRUITMENT_PIPELINE_NAME },
  })
  if (!pipeline) {
    pipeline = await prisma.crm_pipeline.create({
      data: { tenantId, branchId: hrBranch.id, name: RECRUITMENT_PIPELINE_NAME },
    })
    await prisma.crm_stage.createMany({
      data: RECRUITMENT_STAGES.map((s, i) => ({
        tenantId,
        pipelineId: pipeline!.id,
        name: s.name,
        shortCode: s.shortCode,
        order: i,
        color: s.color,
        stuckHoursYellow: 24,
        stuckHoursRed: 48,
      })),
    })
    console.log(`  + created Recruitment pipeline with ${RECRUITMENT_STAGES.length} stages`)
  } else {
    // Ensure all expected stages exist (add missing ones)
    const existing = await prisma.crm_stage.findMany({
      where: { pipelineId: pipeline.id },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((s) => s.name))
    const toAdd = RECRUITMENT_STAGES.filter((s) => !existingNames.has(s.name))
    if (toAdd.length) {
      await prisma.crm_stage.createMany({
        data: toAdd.map((s, i) => ({
          tenantId,
          pipelineId: pipeline!.id,
          name: s.name,
          shortCode: s.shortCode,
          order: existing.length + i,
          color: s.color,
          stuckHoursYellow: 24,
          stuckHoursRed: 48,
        })),
      })
      console.log(`  + added ${toAdd.length} missing stage(s)`)
    } else {
      console.log(`  ✓ Recruitment pipeline already complete`)
    }
  }

  // 3. HR user
  let hrUser = await prisma.crm_auth_user.findUnique({ where: { email: HR_USER_EMAIL } })
  const passwordHash = await bcrypt.hash(HR_USER_PASSWORD, 10)

  if (!hrUser) {
    hrUser = await prisma.crm_auth_user.create({
      data: {
        email: HR_USER_EMAIL,
        name: HR_USER_NAME,
        emailVerified: true,
      },
    })
    await prisma.crm_auth_account.create({
      data: {
        userId: hrUser.id,
        accountId: hrUser.id,
        providerId: 'credential',
        password: passwordHash,
      },
    })
    console.log(`  + created HR user ${HR_USER_EMAIL}`)
  } else {
    // Reset password so it's always `admin123` after re-running seed
    const acct = await prisma.crm_auth_account.findFirst({
      where: { userId: hrUser.id, providerId: 'credential' },
    })
    if (acct) {
      await prisma.crm_auth_account.update({
        where: { id: acct.id },
        data: { password: passwordHash },
      })
    } else {
      await prisma.crm_auth_account.create({
        data: {
          userId: hrUser.id,
          accountId: hrUser.id,
          providerId: 'credential',
          password: passwordHash,
        },
      })
    }
    console.log(`  ✓ HR user already exists, password reset`)
  }

  // 4. Link HR user to HR branch as BRANCH_MANAGER
  const link = await prisma.crm_user_branch.findFirst({
    where: { userId: hrUser.id, branchId: hrBranch.id },
  })
  if (!link) {
    await prisma.crm_user_branch.create({
      data: {
        userId: hrUser.id,
        branchId: hrBranch.id,
        tenantId,
        role: 'BRANCH_MANAGER',
      },
    })
    console.log(`  + linked HR user → HR branch as BRANCH_MANAGER`)
  } else if (link.role !== 'BRANCH_MANAGER') {
    await prisma.crm_user_branch.update({
      where: { id: link.id },
      data: { role: 'BRANCH_MANAGER' },
    })
    console.log(`  ↻ updated HR link role → BRANCH_MANAGER`)
  }

  console.log('\n✓ HR module ready')
  console.log(`  Login: ${HR_USER_EMAIL} / ${HR_USER_PASSWORD}`)
  console.log(`  Branch: ${HR_BRANCH_NAME} (${hrBranch.id})`)
  console.log(`  Pipeline: ${RECRUITMENT_PIPELINE_NAME} with ${RECRUITMENT_STAGES.length} stages`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/crm/auth'
import { prisma } from '@/lib/crm/db'
import { KanbanBoard } from '@/components/crm/opportunities/kanban-board'
import { resolveBranchAccess } from '@/lib/crm/branch-access'

export const dynamic = 'force-dynamic'

export default async function OpportunitiesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect('/login')

  const access = await resolveBranchAccess(session.user.id)
  if (!access) redirect('/login')

  const { tenantId, primaryBranchId: branchId, branchIds, elevated } = access
  const canSwitchBranches = elevated

  // ── Role gate ──────────────────────────────────────────────────────────────
  // Lead opportunities page is for SUPER_ADMIN, AGENCY_ADMIN, BRANCH_MANAGER.
  // HR users (and BRANCH_STAFF / unknown roles) get bounced to the home so
  // they can find the right module.
  const hrmsRole = (session.user as { role?: string } | undefined)?.role
  const allowedLeadRoles = new Set(['SUPER_ADMIN', 'AGENCY_ADMIN', 'BRANCH_MANAGER'])
  if (hrmsRole && !allowedLeadRoles.has(hrmsRole) && !elevated) {
    redirect('/dashboards/crm')
  }

  // Canonical branch names (GHL numbering). HR removed — no pipeline.
  // Dataran Puchong Utama removed from new dropdowns; historical leads
  // tied to its UUID still display via the topbar / kanban.
  const FORM_BRANCHES = [
    '00 Ebright OD',
    '01 Ebright Public Speaking (Online)',
    '02 Ebright Public Speaking (Subang Taipan)',
    '03 Ebright Public Speaking (Setia Alam)',
    '04 Ebright Public Speaking (Sri Petaling)',
    '05 Ebright Kids Public Speaking (Kota Damansara)',
    '06 Ebright Public Speaking (Putrajaya)',
    '07 Ebright Kids Public Speaking (Ampang)',
    '08 Ebright Public Speaking (Cyberjaya)',
    '09 Ebright Public Speaking (Klang)',
    '10 Ebright Kids Public Speaking (Denai Alam)',
    '11 Ebright Public Speaking (Bandar Baru Bangi)',
    '12 Ebright Public Speaking (Danau Kota)',
    '13 Ebright Public Speaking (Shah Alam)',
    '14 Ebright Public Speaking (Bandar Tun Hussein Onn)',
    '15 Ebright Public Speaking (Eco Grandeur)',
    '16 Ebright Public Speaking (Bandar Seri Putra)',
    '17 Ebright Public Speaking Academy (Bandar Rimbayu)',
    '18 Ebright Public Speaking Academy (Taman Sri Gombak)',
    '19 Ebright Public Speaking Academy (Kota Warisan)',
    '20 Ebright Public Speaking Academy (TTDI Grove)',
  ]

  // Parallelise every independent query — the remote Postgres is on a round-
  // trip of ~100–200ms each; running these in sequence makes the page sluggish.
  const [rawPipelines, branches, userBranches] = await Promise.all([
    prisma.crm_pipeline.findMany({
      where: { tenantId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          select: { id: true, name: true, order: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.crm_branch.findMany({
      where: { tenantId, name: { in: FORM_BRANCHES } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.crm_user_branch.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true, email: true } } },
      distinct: ['userId'],
    }),
  ])

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]))

  // Keep only pipelines whose branch is in the canonical list. Opportunities on
  // legacy/removed branches still surface via "All Branches".
  const pipelines = rawPipelines
    .map((p) => {
      const branchName = branchNameById.get(p.branchId)
      if (!branchName) return null
      return { ...p, name: branchName, _branchName: branchName }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    // The Lead opportunities page only shows English-Speaking branch pipelines.
    // HR / Recruitment pipelines live on their own page (/crm/recruitment) and
    // must NOT appear in this dropdown.
    .filter((p) => !/ebright\s*hr/i.test(p._branchName))
    .sort((a, b) => a._branchName.localeCompare(b._branchName))
    .map(({ _branchName: _b, ...rest }) => rest)

  // Role-based scoping:
  //  - SUPER_ADMIN / AGENCY_ADMIN → can see all pipelines + the "All Branches"
  //    aggregate view
  //  - BRANCH_MANAGER (and lower) → locked to the pipelines of every branch
  //    they're explicitly linked to (a user may hold multiple branch grants)
  let scopedPipelines = pipelines
  if (!canSwitchBranches) {
    scopedPipelines = pipelines.filter((p) => branchIds.includes(p.branchId))
  } else {
    // Admins: prepend the synthetic "All Branches" pipeline
    const firstReal = pipelines[0]
    if (firstReal) {
      scopedPipelines = [
        {
          id: `all:${firstReal.id}`,
          branchId: '',
          name: 'All Branches',
          stages: firstReal.stages,
          tenantId,
          createdAt: firstReal.createdAt,
          updatedAt: firstReal.updatedAt,
        } as typeof firstReal,
        ...pipelines,
      ]
    }
  }

  // (userBranches already fetched above in Promise.all — reuse here)
  const users = userBranches.map((ub) => ({
    id: ub.user.id,
    name: ub.user.name,
    email: ub.user.email,
  }))

  const defaultPipelineId = scopedPipelines.find((p) => p.branchId === branchId)?.id
    ?? scopedPipelines[0]?.id
    ?? ''

  if (!defaultPipelineId) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 text-sm p-8">
        No pipelines configured. Go to Settings &rarr; Pipelines to create one.
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Opportunities
        </h1>
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          initialPipelineId={defaultPipelineId}
          pipelines={scopedPipelines}
          branches={branches}
          users={users}
          defaultBranchId={branchId}
          canSwitchBranches={canSwitchBranches}
        />
      </div>
    </div>
  )
}

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/crm/auth'
import { prisma } from '@/lib/crm/db'
import { KanbanBoard } from '@/components/crm/opportunities/kanban-board'
import { resolveBranchAccess } from '@/lib/crm/branch-access'

export const dynamic = 'force-dynamic'

export default async function OpportunitiesPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) redirect('/crm/login')

  const access = await resolveBranchAccess(session.user.id)
  if (!access) redirect('/crm/login')

  const { tenantId, primaryBranchId: branchId, branchIds, elevated } = access
  const canSwitchBranches = elevated

  // Canonical branch names (as stored in DB after the rename migration).
  const FORM_BRANCHES = [
    'Ebright HR',
    '01 Ebright English Speaking (Rimbayu)',
    '02 Ebright English Speaking (Klang)',
    '03 Ebright English Speaking (Shah Alam)',
    '04 Ebright English Speaking (Setia Alam)',
    '05 Ebright English Speaking (Denai Alam)',
    '06 Ebright English Speaking (Eco Grandeur)',
    '07 Ebright English Speaking (Subang Taipan)',
    '08 Ebright English Speaking (Danau Kota)',
    '09 Ebright English Speaking (Kota Damansara)',
    '10 Ebright English Speaking (Ampang)',
    '11 Ebright English Speaking (Sri Petaling)',
    '12 Ebright English Speaking (Bandar Tun Hussein Onn)',
    '13 Ebright English Speaking (Kajang TTDI Grove)',
    '14 Ebright English Speaking (Taman Sri Gombak)',
    '15 Ebright English Speaking (Putrajaya)',
    '16 Ebright English Speaking (Kota Warisan)',
    '17 Ebright English Speaking (Bandar Baru Bangi)',
    '18 Ebright English Speaking (Cyberjaya)',
    '19 Ebright English Speaking (Bandar Seri Putra)',
    '20 Ebright English Speaking (Dataran Puchong Utama)',
    '21 Ebright English Speaking (Online)',
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

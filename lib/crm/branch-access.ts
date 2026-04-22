import { prisma } from '@/lib/crm/db'

/**
 * Returns the list of branch IDs a user can view, plus whether they're an
 * "elevated" role that bypasses branch scoping entirely.
 *
 * - SUPER_ADMIN / AGENCY_ADMIN → elevated: true, `branchIds` still returned
 *   (empty if they have no explicit links) — callers should skip the filter.
 * - BRANCH_MANAGER / BRANCH_STAFF → elevated: false, `branchIds` is the
 *   complete set of branches their user is linked to (a user may have
 *   multiple rows for multi-branch grants).
 *
 * Returns `null` if the user isn't provisioned in any branch (unauthorized).
 */
export async function resolveBranchAccess(userId: string): Promise<{
  tenantId: string
  primaryBranchId: string
  branchIds: string[]
  elevated: boolean
} | null> {
  const links = await prisma.crm_user_branch.findMany({
    where: { userId },
    select: {
      tenantId: true,
      branchId: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  if (links.length === 0) return null

  const tenantId = links[0].tenantId
  const primaryBranchId = links[0].branchId
  const elevated = links.some(
    (l) => l.role === 'SUPER_ADMIN' || l.role === 'AGENCY_ADMIN',
  )
  const branchIds = Array.from(new Set(links.map((l) => l.branchId)))

  return { tenantId, primaryBranchId, branchIds, elevated }
}

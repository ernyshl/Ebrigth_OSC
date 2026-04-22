/**
 * Auth helper for the Ebright ticketing module.
 *
 * Separate from the CRM auth helper — ticket sessions carry additional
 * context (tkt role, platform/branch assignments) loaded from tkt_user_profile.
 *
 * Usage:
 *   // In an API route handler (explicit headers):
 *   const ctx = await requireTktAuth(request.headers, { roles: ['super_admin', 'platform_admin'] })
 *
 *   // In a layout/page (non-throwing):
 *   const ctx = await getTktSession(request.headers)
 *   if (!ctx) redirect('/crm/login')
 */

import { auth } from '@/lib/crm/auth'
import { prisma } from '@/lib/crm/db'
import type { TktRole } from '@/lib/crm/permissions'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TktAuthContext {
  userId: string
  email: string
  name: string | null
  tenantId: string
  role: TktRole
  /** IDs of tkt_platform rows this user administers (platform_admin only). */
  platformIds: string[]
  /** IDs of tkt_branch rows this user belongs to (regular users). */
  branchIds: string[]
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class TktAuthError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode = 401) {
    super(message)
    this.name = 'TktAuthError'
    this.statusCode = statusCode
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolve the tenant ID for a session user.
 *
 * Strategy:
 *  1. crm_user_branch (most users will have at least one branch link)
 *  2. tkt_user_profile.tenant_id (fallback — profile might already exist)
 *  3. crm_tenant where slug = 'ebright-demo' (last-resort for seeded tenants)
 */
async function resolveTenantId(userId: string): Promise<string | null> {
  // 1. From CRM branch assignment
  const branchLink = await prisma.crm_user_branch.findFirst({
    where: { userId },
    select: { tenantId: true },
  })
  if (branchLink) return branchLink.tenantId

  // 2. From existing tkt_user_profile
  const existing = await prisma.tkt_user_profile.findUnique({
    where: { user_id: userId },
    select: { tenant_id: true },
  })
  if (existing) return existing.tenant_id

  // 3. Default tenant (demo / single-tenant deployment)
  const defaultTenant = await prisma.crm_tenant.findUnique({
    where: { slug: 'ebright-demo' },
    select: { id: true },
  })
  return defaultTenant?.id ?? null
}

/**
 * Load or auto-create a tkt_user_profile for the given user.
 *
 * New users get role 'user'. Admins are explicitly promoted via seed/UI.
 */
async function loadOrCreateProfile(
  userId: string,
  tenantId: string,
): Promise<{
  role: TktRole
  platformIds: string[]
  branchIds: string[]
}> {
  let profile = await prisma.tkt_user_profile.findUnique({
    where: { user_id: userId },
    include: {
      platforms: { select: { platform_id: true } },
      branches:  { select: { branch_id: true } },
    },
  })

  if (!profile) {
    profile = await prisma.tkt_user_profile.create({
      data: {
        user_id:   userId,
        tenant_id: tenantId,
        role:      'user',
      },
      include: {
        platforms: { select: { platform_id: true } },
        branches:  { select: { branch_id: true } },
      },
    })
  }

  return {
    role:        profile.role as TktRole,
    platformIds: profile.platforms.map((p) => p.platform_id),
    branchIds:   profile.branches.map((b) => b.branch_id),
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a TktAuthContext from the incoming request headers.
 *
 * @param headers  The `Request.headers` (or `NextRequest.headers`) object.
 * @param opts.roles  If provided, the user's role must be one of these values.
 *
 * @throws {TktAuthError} 401 — no active session.
 * @throws {TktAuthError} 403 — session exists but role not in `opts.roles`.
 * @throws {TktAuthError} 500 — tenant could not be resolved (misconfigured env).
 */
export async function requireTktAuth(
  headers: Headers,
  opts?: { roles?: TktRole[] },
): Promise<TktAuthContext> {
  // DEV-ONLY preview bypass — mirrors app/crm/(protected)/layout.tsx
  if (process.env.CRM_PREVIEW_MODE === 'true') {
    const defaultTenant = await prisma.crm_tenant.findUnique({
      where: { slug: 'ebright-demo' },
      select: { id: true },
    })
    if (!defaultTenant) {
      throw new TktAuthError('Preview mode requires seeded ebright-demo tenant', 500)
    }
    const platforms = await prisma.tkt_platform.findMany({
      where: { tenant_id: defaultTenant.id },
      select: { id: true },
    })
    return {
      userId:      'preview-user',
      email:       'preview@ebright.my',
      name:        'Preview User',
      tenantId:    defaultTenant.id,
      role:        'super_admin',
      platformIds: platforms.map((p) => p.id),
      branchIds:   [],
    }
  }

  // 1. Verify Better Auth session
  const session = await auth.api.getSession({ headers })
  if (!session?.user?.id) {
    throw new TktAuthError('Unauthenticated', 401)
  }

  const { user } = session

  // 2. Resolve tenant
  const tenantId = await resolveTenantId(user.id)
  if (!tenantId) {
    throw new TktAuthError('Tenant could not be resolved for this user', 500)
  }

  // 3. Load or create tkt_user_profile
  const { role, platformIds, branchIds } = await loadOrCreateProfile(user.id, tenantId)

  // 4. Role gate
  if (opts?.roles && !opts.roles.includes(role)) {
    throw new TktAuthError('Forbidden', 403)
  }

  return {
    userId:      user.id,
    email:       user.email,
    name:        user.name ?? null,
    tenantId,
    role,
    platformIds,
    branchIds,
  }
}

/**
 * Like `requireTktAuth` but returns `null` instead of throwing when the user
 * is not authenticated. Useful in layouts/pages where you want to redirect
 * rather than return a 401 JSON response.
 *
 * Role filtering is NOT applied here — call `requireTktAuth` with `roles`
 * when you need to gate on role.
 */
export async function getTktSession(headers: Headers): Promise<TktAuthContext | null> {
  try {
    const session = await auth.api.getSession({ headers })
    if (!session?.user?.id) return null

    const { user } = session

    const tenantId = await resolveTenantId(user.id)
    if (!tenantId) return null

    const { role, platformIds, branchIds } = await loadOrCreateProfile(user.id, tenantId)

    return {
      userId:      user.id,
      email:       user.email,
      name:        user.name ?? null,
      tenantId,
      role,
      platformIds,
      branchIds,
    }
  } catch {
    // Any unexpected error (DB down, etc.) — treat as unauthenticated
    return null
  }
}

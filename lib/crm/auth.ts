/**
 * Better Auth configuration for the CRM module.
 *
 * Uses the shared Postgres database via the Prisma adapter.
 * Tables: crm_auth_user, crm_auth_session, crm_auth_account, crm_auth_verification
 */

import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import bcrypt from 'bcryptjs'
import { prisma } from './db'

const secret = process.env.BETTER_AUTH_SECRET
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('[CRM] BETTER_AUTH_SECRET environment variable is required in production')
}

const _auth = betterAuth({
  secret: secret ?? 'dev-secret-change-in-production',
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  basePath: '/api/crm/auth',

  database: prismaAdapter(prisma, {
    provider: 'postgresql',
    usePlural: false,
    modelPrefix: 'crm_auth_',
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: (password: string) => bcrypt.hash(password, 10),
      verify: ({ password, hash }: { password: string; hash: string }) =>
        bcrypt.compare(password, hash),
    },
  },

  trustedOrigins: [
    'http://localhost:3000',
    process.env.NEXTAUTH_URL ?? '',
  ].filter(Boolean),

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
})

// ─── Preview mode session wrapper ─────────────────────────────────────────────
// When CRM_PREVIEW_MODE=true, every getSession() call returns a fake session so
// routes work without an actual login. Two cookies tune this:
//   crm_preview_exit  = "1"      → skip the preview bypass, force the real login form
//   crm_preview_user  = "<uid>"  → impersonate a specific crm_auth_user
// Without either cookie, the bypass falls back to admin@ebright.my.

function parseCookie(headers: Headers, name: string): string | undefined {
  const raw = headers.get('cookie')
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

let _defaultPreviewUserId: string | null = null

async function getDefaultPreviewUserId(): Promise<string | null> {
  if (_defaultPreviewUserId) return _defaultPreviewUserId
  try {
    const u = await prisma.crm_auth_user.findFirst({
      where: { email: 'admin@ebright.my' },
      select: { id: true },
    })
    // Only cache a successful hit — don't cache null so a transient DB failure
    // doesn't permanently disable preview mode for the lifetime of the process.
    if (u?.id) _defaultPreviewUserId = u.id
    return _defaultPreviewUserId
  } catch {
    return null
  }
}

async function loadUserById(id: string) {
  try {
    return await prisma.crm_auth_user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    })
  } catch (e) {
    // DB unreachable or transient error — treat as user-not-found so auth wrapper
    // can fall back to the default admin instead of throwing a 500 through the page.
    console.warn('[CRM auth] loadUserById failed, falling back to default admin:', (e as Error).message)
    return null
  }
}

const originalGetSession = _auth.api.getSession.bind(_auth.api)

_auth.api.getSession = (async (...args: Parameters<typeof originalGetSession>) => {
  const headers = (args[0] as { headers?: Headers } | undefined)?.headers
  const previewMode = process.env.CRM_PREVIEW_MODE === 'true'

  // Fast path: in preview mode, skip the DB-backed Better Auth lookup entirely
  // unless there's actually a session cookie present. Saves ~100–200ms remote
  // round-trip per request when no one is really logged in.
  const hasSessionCookie =
    headers &&
    (parseCookie(headers, 'better-auth.session_token') !== undefined ||
      parseCookie(headers, '__Secure-better-auth.session_token') !== undefined)

  const real = previewMode && !hasSessionCookie ? null : await originalGetSession(...args)
  if (real) return real
  if (!previewMode) return real

  if (headers) {
    if (parseCookie(headers, 'crm_preview_exit') === '1') return real
    const impersonateId = parseCookie(headers, 'crm_preview_user')
    if (impersonateId) {
      const u = await loadUserById(impersonateId)
      if (u) return synthSession(u)
    }
  }

  const uid = await getDefaultPreviewUserId()
  if (!uid) return real
  return synthSession({ id: uid, email: 'admin@ebright.my', name: 'Preview Admin' })
}) as typeof originalGetSession

function synthSession(u: { id: string; email: string; name: string | null }) {
  return {
    session: {
      id: 'preview-session',
      userId: u.id,
      token: 'preview',
      expiresAt: new Date(Date.now() + 3600_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: u.id,
      email: u.email,
      emailVerified: true,
      name: u.name ?? 'Preview User',
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as unknown as Awaited<ReturnType<typeof _auth.api.getSession>>
}

export const auth = _auth
export type Auth = typeof auth

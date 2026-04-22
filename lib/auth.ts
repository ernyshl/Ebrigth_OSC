import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { hasAnyRole, type Role } from '@/lib/roles';

export type AuthResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

// Requires a logged-in user. Returns { error } with a 401 response if not.
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { session, error: null };
}

// Requires a logged-in user whose role is in the allowlist. Returns { error }
// with 401 if not logged in, 403 if logged in but role not permitted. The role
// is normalized via normalizeRole, so "branch_manager", "BM", etc. are handled.
export async function requireRole(allowed: readonly Role[]): Promise<AuthResult> {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  const role = (session.user as { role?: unknown } | undefined)?.role;
  if (!hasAnyRole(role, allowed)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { session, error: null };
}

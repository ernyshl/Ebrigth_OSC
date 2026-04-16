import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

export type AuthResult =
  | { session: Session; error: null }
  | { session: null; error: NextResponse };

/**
 * Call at the top of any API route handler that requires a logged-in user.
 *
 * Usage:
 *   const { session, error } = await requireSession();
 *   if (error) return error;
 *   // session is now guaranteed to be non-null
 */
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

import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

// `role` intentionally stays `string` here (rather than the strict Role union)
// because NextAuth hands us whatever is in the DB, which may contain legacy
// values. Code that acts on role MUST run it through `normalizeRole` /
// `isAdmin` / `isEmployee` / etc. from `@/lib/roles` — never compare the raw
// string directly.

declare module 'next-auth' {
  interface User extends DefaultUser {
    role: string;
    branchName: string | null;
  }

  interface Session extends DefaultSession {
    user: {
      role: string;
      branchName: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: string;
    branchName: string | null;
    // Unix ms of the last time `role`/`branchName`/`status` were reconciled
    // against the database. Used by lib/nextauth.ts to rate-limit the re-check.
    checkedAt?: number;
  }
}

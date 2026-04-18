import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

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
  }
}

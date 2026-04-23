import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Max staleness for the role/status cached in a JWT. After this window, the
// next request triggers a DB lookup so demoting/deactivating a user takes
// effect without requiring them to log out.
const ROLE_REFRESH_MS = 60_000;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Username/Email", type: "text" },
        password: { label: "Password",       type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id:         user.id.toString(),
          email:      user.email,
          name:       user.name,
          role:       user.role,
          branchName: user.branchName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, seed the token from the authorize() return value.
      if (user) {
        token.name       = user.name;
        token.role       = user.role;
        token.branchName = user.branchName;
        token.checkedAt  = Date.now();
        return token;
      }

      // On every subsequent request NextAuth re-decodes the JWT and calls this
      // callback. Re-read from the DB at most once per ROLE_REFRESH_MS so that:
      //   (a) a role change in the DB is reflected within ~60s, and
      //   (b) a deactivated user loses effective privileges within ~60s.
      const checkedAt = token.checkedAt ?? 0;
      if (Date.now() - checkedAt < ROLE_REFRESH_MS) return token;

      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: String(token.email) },
          select: { role: true, branchName: true, status: true, name: true },
        });

        if (!dbUser || dbUser.status !== "ACTIVE") {
          // Missing or deactivated. We can't fully kill the session from here
          // (NextAuth's JWT strategy has no server-side revocation), but we
          // can zero out the role so every requireRole check and the
          // middleware's role rules fail closed.
          token.role       = "";
          token.branchName = null;
        } else {
          token.role       = dbUser.role;
          token.branchName = dbUser.branchName;
          token.name       = dbUser.name;
        }
        token.checkedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name       = token.name;
        session.user.role       = token.role;
        session.user.branchName = token.branchName;
      }
      return session;
    },
  },
  pages:   { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret:  process.env.NEXTAUTH_SECRET,
};

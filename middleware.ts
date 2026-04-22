import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Exclude: API routes, Next.js internals, static files, HRMS login, and all CRM routes (CRM has its own auth)
    "/((?!api|_next/static|_next/image|favicon.ico|login|crm).*)",
  ],
};
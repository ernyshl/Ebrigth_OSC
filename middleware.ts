import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { normalizeRole, ADMIN_ROLES, MANAGEMENT_ROLES, type Role } from "@/lib/roles";

// Path-prefix-based role rules. First matching prefix wins — so list more
// specific prefixes before shorter ones that would also match.
//
// Any path NOT matched here only needs the user to be logged in (enforced by
// the `authorized` callback below).
const ROLE_RULES: Array<{ prefix: string; allowed: readonly Role[] }> = [
  // Admin-only pages (user / account administration)
  { prefix: "/user-management",               allowed: ADMIN_ROLES },
  { prefix: "/account-management",            allowed: ADMIN_ROLES },
  { prefix: "/register-employee",             allowed: ADMIN_ROLES },

  // Management-level pages (HR operations, scheduling, employee roster)
  { prefix: "/dashboard-employee-management", allowed: MANAGEMENT_ROLES },
  { prefix: "/manpower-schedule",             allowed: MANAGEMENT_ROLES },
  { prefix: "/hr-dashboard",                  allowed: MANAGEMENT_ROLES },
  { prefix: "/onboarding",                    allowed: MANAGEMENT_ROLES },
  { prefix: "/offboarding",                   allowed: MANAGEMENT_ROLES },
];

function matchRule(pathname: string) {
  return ROLE_RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const rule = matchRule(pathname);
    if (!rule) return NextResponse.next();

    const role = normalizeRole(req.nextauth.token?.role);
    if (role && rule.allowed.includes(role)) return NextResponse.next();

    // Logged in but wrong role — send to /home with a flag so the UI can
    // surface "you don't have access to X" if it wants to.
    const homeUrl = new URL("/home", req.url);
    homeUrl.searchParams.set("forbidden", pathname);
    return NextResponse.redirect(homeUrl);
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|forgot-password).*)",
  ],
};

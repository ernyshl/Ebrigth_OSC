import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { normalizeRole, ROLES, type Role } from "@/lib/roles";

// Path-prefix-based role rules. First matching prefix wins — so list more
// specific prefixes before shorter ones that would also match.
//
// Any path NOT matched here only needs the user to be logged in (enforced by
// the `authorized` callback below).
//
// SUPER_ADMIN is granted everything via an explicit bypass below; you do not
// need to list SUPER_ADMIN in every allowlist (it's included for clarity).
//
// Per-role intent:
//   BRANCH_MANAGER → /manpower-schedule (+ Inventory tile, gated client-side)
//   HR             → keeps prior management access EXCEPT /manpower-schedule
//   ACADEMY        → keeps prior access (+ Inventory tile, client-side)
//   FULL_TIME / PART_TIME → /manpower-schedule/archive (Manpower Cost Report
//                   is login-only and reachable as before)
const ROLE_RULES: Array<{ prefix: string; allowed: readonly Role[] }> = [
  { prefix: "/user-management",               allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.ACADEMY] },
  { prefix: "/account-management",            allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR] },
  { prefix: "/register-employee",             allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR] },
  { prefix: "/dashboard-employee-management", allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.HOD, ROLES.ACADEMY] },

  // /archive must come BEFORE /manpower-schedule so PT/FT can read archives
  // even though the parent path is otherwise blocked for them.
  { prefix: "/manpower-schedule/archive",     allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.HOD, ROLES.FULL_TIME, ROLES.PART_TIME] },
  { prefix: "/manpower-schedule",             allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.HOD] },

  { prefix: "/hr-dashboard",                  allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.HOD] },
  { prefix: "/onboarding",                    allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.HOD] },
  { prefix: "/offboarding",                   allowed: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.HOD] },
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
    if (role === ROLES.SUPER_ADMIN) return NextResponse.next();
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

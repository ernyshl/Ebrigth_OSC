# Ebright OSC Modernization — Design Spec

**Date:** 2026-04-27
**Scope:** Multi-week refactor of the Ebright OSC portal to bring it onto the Ebright standard tech stack with multi-tenant data scoping, role-based access control, audit logging, and a Server-first data flow.
**Out of scope:** see §6.

---

## 1. Goal

Transform the OSC repo from a flat, client-heavy, single-tenant Next.js 15 App Router app into a tenant-scoped, RBAC-enforced, audit-logged system that matches the Ebright standard stack (TanStack Query, TanStack Table, React Hook Form + Zod, shadcn/ui for new surfaces, Sonner). Establish a Playwright smoke suite as a regression safety net for the migration itself.

The functional behavior of the app must not change for end users beyond:
- Same-branch data is unchanged.
- Cross-branch reads now go through audit logging.
- A few visual differences where new surfaces use shadcn/ui (toasts, data tables).

---

## 2. Decisions locked during brainstorming

| # | Question | Choice |
|---|---|---|
| 1 | Tenant boundary | **(C) Two-level**: Tenant (company) + Branch (sub-tenant). Both `tenantId` and `branchId` on every business model. |
| 2 | Tenant resolution | **(A) Session-only** — `session.user.tenantId` set at login. No subdomains. |
| 3 | RBAC model | **(A) Keep existing 5 roles** (`SUPER_ADMIN`, `ADMIN`, `HR`, `BRANCH_MANAGER`, `PART_TIME`); normalize casing; permissions in static `lib/permissions.ts` map. No `Role`/`Permission` DB tables. |
| 4 | Test strategy | **(B) Smoke tests only** — 5–10 Playwright tests covering golden paths. |
| 5 | Branch & PR strategy | **(A) One PR per Step** (5 PRs total: critical, folders, stack, cleanup, verify). |
| 6 | Data backfill | **(B) Three-phase** Prisma migration: add nullable cols, backfill via script, enforce NOT NULL + drop `branchName`. |
| 7 | TanStack Query rollout | **(B) Module-by-module**: HRMS → attendance → claims → manpower-schedule → account-management → user-management. |
| 8 | shadcn/ui scope | **(B) New surfaces only** — DataTable wrapper, Sonner, RHF helpers. Existing styled buttons/inputs left alone. |
| 9 | Audit logging | **(B) Writes + cross-boundary reads** — log all mutations, log reads where actor's branch ≠ resource's branch, log all exports. |
| 10 | scanner-webhook fate | **(A) Delete** — confirmed dormant; pull approach via `lib/scanner-sync.ts` is the live integration. |

---

## 3. Architecture

### 3.1 Target folder structure

```
Ebrigth_OSC/
├── app/
│   ├── (auth)/                     login, forgot-password
│   ├── (dashboard)/
│   │   ├── layout.tsx              # SessionProvider + auth guard
│   │   ├── home/
│   │   ├── hrms/
│   │   │   ├── dashboard-employee-management/
│   │   │   ├── attendance/{,appeal,leave,report,summary}/
│   │   │   ├── claims/
│   │   │   ├── manpower-schedule/{,archive,plan-new-week,update}/
│   │   │   ├── manpower-cost-report/
│   │   │   ├── manpower-planning/
│   │   │   ├── onboarding/  offboarding/  register-employee/
│   │   │   └── hr-dashboard/
│   │   ├── academy/  sms/  account-management/  user-management/
│   │   └── profile/  dashboards/[id]/
│   ├── api/                        # Route Handlers — thin wrappers
│   ├── globals.css                 # Tailwind v4 @theme tokens
│   └── layout.tsx
├── components/
│   ├── ui/                         # shadcn primitives (new surfaces only)
│   ├── shared/                     # Sidebar, UserHeader, Providers
│   └── <module>/                   # module-specific
├── lib/
│   ├── prisma.ts
│   ├── auth.ts                     # consolidated authOptions + requireSession
│   ├── permissions.ts              # NEW — static role→permission map
│   ├── tenant.ts                   # NEW — scopedDb(session) wrapper
│   ├── audit.ts                    # NEW — logAudit() helper
│   ├── logger.ts                   # NEW — pino-style structured logger
│   ├── constants.ts
│   └── utils.ts
├── hooks/                          # NEW — TanStack Query hooks
├── server/
│   ├── actions/                    # NEW — Server Actions for mutations
│   └── queries/                    # NEW — Prisma reads, callable from Server Components
├── validations/                    # NEW — Zod schemas shared by actions + forms
├── types/
│   ├── next-auth.d.ts
│   └── domain.ts                   # NEW — Tenant, Branch, Employee interfaces
├── tests/e2e/                      # NEW — Playwright smoke suite
├── scripts/
│   └── backfill-tenants.ts         # NEW — one-shot data migration script
├── prisma/schema.prisma            # adds Tenant, Branch, AuditLog
├── middleware.ts                   # explicit-allow public matcher
└── docker/                         # unchanged
```

### 3.2 Auth flow

- `useSession()` only inside `<SessionProvider>` (Client Components). Every server file uses `requireSession()` from `lib/auth.ts`.
- Session payload extends `{ id, email, role, branchName }` with `{ tenantId, branchId }` (populated in `jwt` + `session` callbacks at login by reading `User.tenantId` / `User.branchId`).
- Middleware matcher: explicit-allow style.
  ```ts
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|login|forgot-password).*)"]
  ```
  - `api/*` (other than `api/auth`) is not gated by middleware. Each Route Handler enforces its own `requireSession()`. This is the security boundary.
- API Route Handlers exist only for (a) TanStack Query GET endpoints, (b) external integrations (e.g. `sync-medical-leave`). Form mutations are Server Actions.

### 3.3 Data flow

- **Server Components are default.** Pages read DB data by calling `server/queries/<feature>.ts` directly (no `fetch` round-trip).
- **Client Components needing live data** wrap a Route Handler GET in a TanStack Query hook from `hooks/use<Feature>.ts`.
- **Forms** call Server Actions in `server/actions/<feature>.ts` with `"use server"` directive.
- **Prisma queries never appear in `app/**/page.tsx` or `components/**`.**

### 3.4 Multi-tenant scoping

`lib/tenant.ts` exports `scopedDb(session)`. This wraps the Prisma client in a Proxy that auto-injects `tenantId` (and `branchId` for branch-restricted roles) into every `where` clause:

```ts
const db = scopedDb(session)
await db.employee.findMany({ where: { active: true } })
// effective: prisma.employee.findMany({ where: { active:true, tenantId, branchId? }})
```

| Role | Auto-injects |
|---|---|
| SUPER_ADMIN | nothing (must pass `tenantId` explicitly) |
| ADMIN | `tenantId` only |
| HR | `tenantId` only |
| BRANCH_MANAGER | `tenantId` AND `branchId` |
| PART_TIME | `tenantId` AND `branchId` |

Raw `prisma` import remains allowed for system-level code (cron, scanner-sync, audit log writes). Lints/conventions block raw `prisma` usage in `server/queries/*` and `server/actions/*`.

---

## 4. Data model

### 4.1 New tables

```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique          // "ebright"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branches  Branch[]
  users     User[]
  // ... reverse relations on every business model

  @@index([slug])
}

model Branch {
  id        String   @id @default(cuid())
  tenantId  String
  name      String                    // "Ampang", "Klang", "HQ", ...
  code      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  users             User[]
  staff             BranchStaff[]
  employees         Employee[]
  schedules         ManpowerSchedule[]
  attendance        AttendanceLog[]
  leaveTransactions LeaveTransaction[]

  @@unique([tenantId, name])
  @@index([tenantId])
}

model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String
  actorId    Int                      // User.id
  actorEmail String                   // denormalized for hard-deletes
  action     String                   // "claim.read", "employee.update", "schedule.export"
  resource   String                   // "Employee", "Claim", etc.
  resourceId String?
  metadata   Json?                    // {before, after} on writes; {filter} on cross-boundary reads
  ipAddress  String?
  createdAt  DateTime @default(now())

  @@index([tenantId, createdAt])
  @@index([actorId, createdAt])
  @@index([resource, resourceId])
}
```

### 4.2 Existing model amendments

`User`, `Employee`, `BranchStaff`, `AttendanceLog`, `LeaveTransaction`, `ManpowerSchedule` each gain:

- `tenantId  String?` — FK → `Tenant.id` (nullable in Step 3a, NOT NULL in 3c)
- `branchId  String?` — FK → `Branch.id` (nullable in Step 3a, NOT NULL in 3c)
- `updatedAt DateTime @updatedAt` — added where missing
- `@@index([tenantId])`, `@@index([branchId])`, plus indexes on commonly-filtered columns (`date`, `empNo`, `status`)

### 4.3 ID strategy

New tables (`Tenant`, `Branch`, `AuditLog`) use `cuid()` strings. **Existing tables retain Int autoincrement IDs** — changing primary keys mid-migration is too risky given external scanner references and existing FK relationships. This is a deliberate deviation from the Ebright standard for this migration; future tables must use `cuid()`.

### 4.4 Backfill plan (Step 3 phases)

**Phase 1 (3a)** — `prisma migrate`: add nullable `tenantId`/`branchId` columns + `Tenant`/`Branch`/`AuditLog` tables + `updatedAt` + indexes.

**Phase 2 (3b)** — `scripts/backfill-tenants.ts`:
1. Insert one `Tenant{ slug:"ebright" }`.
2. Insert one `Branch` per distinct `User.branchName` value (Ampang, Klang, Setia Alam, …) plus `HQ`.
3. For every row in each business model: set `tenantId = ebright.id`; set `branchId` by matching `branchName` against the new `Branch` table.
4. Print rows where lookup fails. Halt unless 100% matched after manual cleanup.

**Phase 3 (3c)** — `prisma migrate`: enforce `tenantId`/`branchId` `NOT NULL`; drop free-text `branchName` columns from `User`/`Employee`/`BranchStaff`/`AttendanceLog`/`LeaveTransaction`/`ManpowerSchedule`.

### 4.5 Role normalization

Step 1 updates existing User rows: `Part_Time → PART_TIME`. Other casing already correct. Validated by Zod enum on every Server Action / Route Handler input that accepts a role.

---

## 5. Auth, RBAC & audit

### 5.1 Session payload

```ts
session.user = {
  id: number,
  email: string,
  role: "SUPER_ADMIN" | "ADMIN" | "HR" | "BRANCH_MANAGER" | "PART_TIME",
  tenantId: string,
  branchId: string,
  branchName: string,    // display only — never used for scoping
}
```

### 5.2 `lib/permissions.ts`

```ts
export const PERMISSIONS = {
  SUPER_ADMIN:    { all: true },                                // bypasses tenant scope
  ADMIN:          { tenant: "*", branch: "*", actions: ["read","write","approve"] },
  HR:             { tenant: "self", branch: "*", actions: ["read","write"] },
  BRANCH_MANAGER: { tenant: "self", branch: "self", actions: ["read","write"] },
  PART_TIME:      { tenant: "self", branch: "self", actions: ["read"] },
} as const

export function can(session, action, resource): boolean
```

Every Server Action and Route Handler starts with: `requireSession()` → `assertCan(session, action, resource)` → query.

### 5.3 `lib/audit.ts`

```ts
await logAudit(session, {
  action: "claim.read",
  resource: "Claim",
  resourceId: claim.id,
  metadata: { branch: claim.branchId, status: claim.status },
})
```

Called from:
- Every write in `server/actions/*` (after the mutation succeeds).
- Cross-boundary reads in `server/queries/*` — when `session.branchId !== resource.branchId`.
- All exports / PDF generation.

Synchronous insert into `AuditLog`. Failure to log emits `logger.error` but does not block the user-facing operation.

---

## 6. Execution plan

### Step 1 — Critical security + build (~3 days)
PR: `refactor/step-1-critical` → `staging`.

1. Set up Playwright smoke suite (login → home → HRMS → submit claim → edit schedule) AND `.github/workflows/playwright.yml` running on every PR. Green baseline.
2. Delete `app/api/scanner-webhook/route.ts`.
3. Move AutoCount token to `process.env.AUTOCOUNT_API_TOKEN`. Add to `.env.example` placeholder + deploy server `.env`.
4. Lock 5 unauthenticated routes (`attendance-today`, `hr-dashboard`, `manpower-cost`, `sync-medical-leave`, `test-scanner`) with `requireSession()`.
5. Add minimal RBAC on `users`, `branch-staff`, `employees`: `assertCan(session, ...)`.
6. Fix the 7 TypeScript errors. Remove `typescript: { ignoreBuildErrors: true }` from `next.config.ts`.
7. Fix `eslint.config.mjs` to canonical Next flat config.
8. Add `typecheck` script to `package.json`.

Smoke green. Merge to `staging` → auto-deploy → verify → merge to `main`.

### Step 2 — Folder reorganization (~3 days)
PR: `refactor/step-2-folders` → `staging`.

1. Create new dirs.
2. Move all `app/components/*` to `components/<module>/*` or `components/shared/*`. One file at a time, update imports, `npx tsc --noEmit` between each.
3. Consolidate `lib/auth.ts` + `lib/nextauth.ts` → single `lib/auth.ts`.
4. Move login/forgot-password under `app/(auth)/`. Move dashboard pages under `app/(dashboard)/` with `layout.tsx` providing `<SessionProvider>` + auth guard.
5. Group HRMS pages under `app/(dashboard)/hrms/<feature>/`.
6. Update middleware matcher.
7. Smoke stays green.

### Step 3 — Stack migrations (~2.5 weeks)
PR: `refactor/step-3-stack` → `staging`. Sub-PRs internally:

- **3a** — Prisma schema phase 1 (additive).
- **3b** — Backfill script run.
- **3c** — Prisma schema phase 2 (NOT NULL + drop `branchName`).
- **3d** — Auth layer (`permissions.ts`, `tenant.ts`, `audit.ts`, `logger.ts`).
- **3e** — Extract Prisma queries from API routes → `server/queries/*`. Add Zod to all 15 unvalidated routes.
- **3f** — Server Actions for mutations.
- **3g** — TanStack Query module-by-module: HRMS → attendance → claims → manpower-schedule → account-management → user-management.
- **3h** — TanStack Table — install + DataTable wrapper + refactor top 3 tables (AttendanceSummary, EmployeeTable, UserManagement).
- **3i** — RHF + Zod — migrate `RegistrationForm`, `AppealOptions`, `claims` forms, `login`, `forgot-password`.
- **3j** — Sonner — install, add `<Toaster />`, replace `alert()` and inline status.
- **3k** — shadcn/ui — init, use for DataTable wrapper + form helpers + toast. Don't rewrite existing buttons.
- **3l** — God file split — `claims/page.tsx` (1855 lines), `manpower-schedule/{update,plan-new-week}/page.tsx` into smaller components + custom hooks.

### Step 4 — Minor cleanup (~3 days)
PR: `refactor/step-4-cleanup` → `staging`.

1. Replace 67 hardcoded hex colors with `@theme` tokens.
2. Replace 9 inline `style={{}}` with Tailwind utilities.
3. Replace 43 raw `<svg>` icons with `lucide-react`.
4. Wrap 37 `console.*` through `lib/logger.ts`.
5. Replace 16 `any` usages with concrete types.
6. Enable `noUnusedLocals` + `noUnusedParameters` in `tsconfig.json`. Fix violations.
7. Add `format` script (Prettier).

### Step 5 — Final verification (~0.5 day)
PR: `refactor/step-5-verify` → `staging` → `main`.

1. `npx tsc --noEmit` clean.
2. `npx eslint . --ext .ts,.tsx` clean.
3. `npm run build` succeeds.
4. `npm run dev` boots clean.
5. Docker: `docker build` + `docker run -p 3000:3000` smoke test.
6. Playwright suite green against the dockerized container.
7. **DB credential rotation** — rotate `optidept` password on prod DB; update server `.env`; redeploy. Mark `.env.example` placeholder.

---

## 7. Error handling, testing, observability, rollback

### 7.1 Error handling

- Server Actions return typed `{ ok: true, data } | { ok: false, error: { code, message } }`. Client unwraps via `unwrap()`.
- Route Handlers: try/catch wraps every body, return `NextResponse.json({error}, {status})`. Generic messages externally; full error to `logger.error`.
- `lib/logger.ts` — pino-style structured logger. Replaces all `console.*`.
- Forms surface field errors via RHF; submit errors via Sonner toast.

### 7.2 Testing

Playwright smoke suite (`tests/e2e/`), runs in CI on every PR:

1. ADMIN login → /home → all 7 cards visible.
2. BRANCH_MANAGER (Ampang) login → /home shows HRMS unlocked only.
3. HRMS dashboard → loads, shows employees for Ampang only.
4. Submit a claim → success toast → claim appears in list.
5. Edit a manpower schedule → save → reload shows persisted change.
6. Direct hit `/api/employees` without session → 401.
7. BRANCH_MANAGER (Ampang) requests another branch's data → 403.

Test database: `ebright_hrfs_test`, seeded by `scripts/seed-test.ts` with one tenant, two branches, three users.

CI: a new `.github/workflows/playwright.yml` runs the suite on every PR against `staging`, using a Postgres service container and an isolated test database. Step 1 establishes both the suite and the workflow green; subsequent steps must keep it green.

### 7.3 Observability

- Audit log writes go to `AuditLog` table. Retention: indefinite for now; revisit in 12 months per PDPA review.
- App logs via `lib/logger.ts` — JSON output captured by Docker, tailable on the staging server.
- No metrics/tracing infra added in this migration.

### 7.4 Rollback

- Each Step PR is a single squash merge; revert = revert merge commit; auto-deploy reverts.
- Step 3a/3b/3c (Prisma migrations) are **not safely revertable via git revert alone**:
  - 3a (additive nullable cols + new tables): trivially revertable.
  - 3b (backfill): re-runnable; idempotent.
  - 3c (drop `branchName`, NOT NULL): point of no return. **Take a DB snapshot before merging 3c.** Rollback = restore snapshot.
- Smoke suite running against staging is the primary gate before each merge to `main`.

---

## 8. Out of scope

Explicitly excluded from this migration:
- BullMQ + Redis (no background jobs added).
- Resend (nodemailer stays).
- AWS S3 (no file uploads).
- Tremor (recharts stays — only 2 charts; not worth the swap).
- Multi-tenant onboarding UI (single seeded `Ebright` tenant is enough).
- shadcn migration of existing pages (only new surfaces use shadcn).
- TanStack Table for all 18 tables (only top 3 migrate; rest TODO-marked).
- Tests beyond smoke (no unit, no integration).
- Tremor dashboards.
- Dynamic permission system (no `Role`/`Permission` DB tables; `lib/permissions.ts` is a static map).

---

## 9. Open questions to revisit during execution

- `assertCan` semantics for "approve" actions on claims — does HR approve, or does ADMIN only? Confirm with stakeholder before Step 3d.
- Backfill behavior for Users with `branchName = "HR"` — they should map to a synthetic `HQ` branch or remain branch-less? Confirm with stakeholder before running 3b.
- Whether the Hikvision scanner ever needs to push (currently we only pull). If yes after migration, restore `scanner-webhook` from git with HMAC auth.

---

## 10. Estimated effort

| Step | Files touched | Complexity | Effort |
|---|---|---|---|
| 1 — Critical | ~15 | Low–medium | 3 days |
| 2 — Folders | ~90 moved + imports rewritten | Medium | 3 days |
| 3 — Stack migrations | ~80 rewritten | High | 2.5 weeks |
| 4 — Cleanup | ~80 | Low | 3 days |
| 5 — Verify | — | Low | 0.5 day |

**Total: ~3.5 weeks of focused engineering.**

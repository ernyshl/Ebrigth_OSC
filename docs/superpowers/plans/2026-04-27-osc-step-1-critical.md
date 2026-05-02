# OSC Modernization — Step 1: Critical Security + Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a Playwright smoke baseline, close the six known security holes, fix the seven TypeScript errors hidden by `ignoreBuildErrors`, and add minimal RBAC to the three dangerous endpoints — without altering normal user-visible behavior.

**Architecture:** Minimum-viable safety pass before the larger modernization work. Touches only the files needed to (a) establish a CI-running regression test suite, (b) add `requireSession()` checks to currently-public routes, (c) add interim role-based gating on three admin endpoints via a small `requireRole()` helper, (d) externalize the AutoCount API token, (e) delete a dormant integration, and (f) get `npx tsc --noEmit` and `npm run build` running clean. No folder reorganization, no schema changes, no data fetching refactors — those come in Steps 2 and 3.

**Tech Stack:** Next.js 15.1, NextAuth 4.24, Prisma 6.19, Tailwind v4 (existing) + Playwright 1.x (new), GitHub Actions for CI (new).

**Spec:** `docs/superpowers/specs/2026-04-27-osc-modernization-design.md` §6 Step 1.

**Branch:** `refactor/step-1-critical` off `staging`.

---

## File Structure

Files to create:
| Path | Responsibility |
|---|---|
| `playwright.config.ts` | Playwright configuration (base URL, web server, projects) |
| `tests/e2e/auth.spec.ts` | Smoke test: ADMIN + BRANCH_MANAGER login flows |
| `tests/e2e/claims.spec.ts` | Smoke test: claim submit happy path |
| `tests/e2e/manpower-schedule.spec.ts` | Smoke test: schedule edit happy path |
| `tests/e2e/api-auth.spec.ts` | Smoke test: unauth API → 401 |
| `tests/e2e/fixtures.ts` | Shared Playwright fixtures (auth helper) |
| `scripts/seed-test.ts` | Seeds the `ebright_hrfs_test` DB with one company + two branches + three users |
| `.github/workflows/playwright.yml` | CI: run smoke suite on every PR |
| `.env.test` | Local test env vars (gitignored) |

Files to modify:
| Path | What changes |
|---|---|
| `package.json` | Add `playwright`, `@playwright/test`, `tsx` devDeps; add `test`, `test:e2e`, `typecheck`, `seed:test` scripts |
| `lib/auth.ts` | Add `requireRole(session, allowed[])` helper |
| `app/api/sync-medical-leave/route.ts` | Read `AUTOCOUNT_API_TOKEN` from env; add `requireSession()` |
| `app/api/attendance-today/route.ts` | Add `requireSession()` |
| `app/api/hr-dashboard/route.ts` | Add `requireSession()` |
| `app/api/manpower-cost/route.ts` | Add `requireSession()` |
| `app/api/test-scanner/route.ts` | Add `requireSession()` |
| `app/api/users/route.ts` | Add `requireRole(session, ['ADMIN','SUPER_ADMIN'])` on POST/PATCH/DELETE |
| `app/api/branch-staff/route.ts` | Add interim branch scoping (read uses `session.user.branchName` filter unless ADMIN/SUPER_ADMIN) |
| `app/api/employees/route.ts` | Add interim branch scoping (same pattern) |
| `app/offboarding/page.tsx` | Fix `percent` possibly undefined |
| `tsconfig.json` | Add `"client"` to exclude (the unrelated subproject) |
| `next.config.ts` | Remove `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` |
| `eslint.config.mjs` | Replace stub with canonical Next flat config |
| `.env.example` | Add `AUTOCOUNT_API_TOKEN` placeholder |
| `.gitignore` | Add `.env.test` |

Files to delete:
| Path | Why safe |
|---|---|
| `app/api/scanner-webhook/route.ts` | Confirmed dormant (we pull via `lib/scanner-sync.ts`); single git commit; no callers grepped. Restore from `9925451e` if push integration ever needed. |

---

## Task 1: Install Playwright + tsx

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dev dependencies**

```bash
cd "c:/Users/user/Desktop/baltoratora/00 OPTIMISATION DEPARTMENT/VSC/OSC/Ebrigth_OSC"
git checkout staging
git pull origin staging
git checkout -b refactor/step-1-critical
npm install --save-dev @playwright/test playwright tsx
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Verify installation**

Run: `npx playwright --version`
Expected: `Version 1.x.x`

Run: `npx tsx --version`
Expected: a version number, no error.

- [ ] **Step 3: Add scripts to package.json**

Edit `package.json` `scripts` section to:

```json
"scripts": {
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "playwright test",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "seed:test": "tsx scripts/seed-test.ts"
},
```

- [ ] **Step 4: Verify scripts are visible**

Run: `npm run`
Expected output includes `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `test:e2e:ui`, `seed:test`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(test): install Playwright + tsx; add typecheck/test/seed scripts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Configure Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `.env.test`
- Modify: `.gitignore`

- [ ] **Step 1: Add `.env.test` to gitignore**

Edit `.gitignore`. Add this block at the end:

```
# Playwright
.env.test
test-results/
playwright-report/
playwright/.cache/
```

- [ ] **Step 2: Create `.env.test`**

Create file `.env.test` with placeholder values (engineer fills with their own local Postgres test DB):

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/ebright_hrfs_test?schema=public"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="test-secret-not-for-production"
AUTOCOUNT_API_TOKEN="test-token"
PLAYWRIGHT_BASE_URL="http://localhost:3001"
```

- [ ] **Step 3: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { config as dotenv } from 'dotenv';

dotenv({ path: '.env.test' });

const PORT = 3001;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // tests share a DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    },
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Install dotenv (used above)**

```bash
npm install --save-dev dotenv
```

- [ ] **Step 5: Verify config parses**

Run: `npx playwright test --list`
Expected: `Total: 0 tests in 0 files` (no tests written yet, but config parsed without errors).

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts .env.test .gitignore package.json package-lock.json
git commit -m "chore(test): add Playwright config + .env.test scaffold

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Test database seed script

**Files:**
- Create: `scripts/seed-test.ts`

- [ ] **Step 1: Write seed script**

Create `scripts/seed-test.ts`:

```ts
/**
 * Seeds the test database with deterministic fixtures used by the smoke suite.
 * Run via: `npm run seed:test` (loads .env.test).
 *
 * Idempotent: deletes everything first, then re-inserts.
 *
 * Users created:
 *  - test.admin@ebright.test    / pass1234   role=ADMIN          branch=HQ
 *  - test.ampang@ebright.test   / pass1234   role=BRANCH_MANAGER branch=Ampang
 *  - test.klang@ebright.test    / pass1234   role=BRANCH_MANAGER branch=Klang
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as dotenv } from 'dotenv';

dotenv({ path: '.env.test' });

const prisma = new PrismaClient();

const PASSWORD = 'pass1234';

async function main() {
  console.log('Seeding test database…');

  // Clean order respects FKs.
  await prisma.attendanceLog.deleteMany();
  await prisma.leaveTransaction.deleteMany();
  await prisma.manpowerSchedule.deleteMany();
  await prisma.branchStaff.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);

  await prisma.user.createMany({
    data: [
      { email: 'test.admin@ebright.test',  passwordHash: hash, role: 'ADMIN',          branchName: 'HQ' },
      { email: 'test.ampang@ebright.test', passwordHash: hash, role: 'BRANCH_MANAGER', branchName: 'Ampang' },
      { email: 'test.klang@ebright.test',  passwordHash: hash, role: 'BRANCH_MANAGER', branchName: 'Klang' },
    ],
  });

  await prisma.branchStaff.createMany({
    data: [
      { employeeId: 'EMP-AMPANG-1', name: 'Ampang Staff One', email: 'ampang1@ebright.test', branch: 'Ampang' },
      { employeeId: 'EMP-KLANG-1',  name: 'Klang Staff One',  email: 'klang1@ebright.test',  branch: 'Klang' },
    ],
  });

  console.log('Test database seeded.');
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the seed**

Engineer must first ensure `ebright_hrfs_test` Postgres DB exists and `DATABASE_URL` in `.env.test` points at it.

Run: `npm run seed:test`
Expected:
```
Seeding test database…
Test database seeded.
```

- [ ] **Step 3: Verify DB contents**

Run: `npx tsx -e "import {PrismaClient} from '@prisma/client'; import {config} from 'dotenv'; config({path:'.env.test'}); const p = new PrismaClient(); p.user.count().then(n => { console.log('users:', n); p.\$disconnect(); });"`
Expected: `users: 3`

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-test.ts
git commit -m "chore(test): add seed-test.ts for deterministic Playwright fixtures

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Auth smoke test (login flows)

**Files:**
- Create: `tests/e2e/fixtures.ts`
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 1: Create shared login fixture**

Create `tests/e2e/fixtures.ts`:

```ts
import { test as base, expect, type Page } from '@playwright/test';

export type LoginRole = 'admin' | 'ampang' | 'klang';

const CREDENTIALS: Record<LoginRole, { email: string; password: string }> = {
  admin:  { email: 'test.admin@ebright.test',  password: 'pass1234' },
  ampang: { email: 'test.ampang@ebright.test', password: 'pass1234' },
  klang:  { email: 'test.klang@ebright.test',  password: 'pass1234' },
};

export async function login(page: Page, role: LoginRole) {
  const { email, password } = CREDENTIALS[role];
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL(/\/home/);
}

export const test = base;
export { expect };
```

- [ ] **Step 2: Write the failing test**

Create `tests/e2e/auth.spec.ts`:

```ts
import { test, expect, login } from './fixtures';

test.describe('Authentication smoke', () => {
  test('ADMIN logs in and lands on /home with all 7 module cards', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/home/);

    // 7 modules visible by title
    const titles = ['Library', 'Internal Dashboard', 'HRMS', 'CRM', 'SMS', 'Inventory', 'Academy'];
    for (const t of titles) {
      await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
    }

    // No "Locked" pill should be present for ADMIN
    await expect(page.getByText('Locked', { exact: false })).toHaveCount(0);
  });

  test('BRANCH_MANAGER (Ampang) logs in and sees only HRMS unlocked', async ({ page }) => {
    await login(page, 'ampang');
    await expect(page).toHaveURL(/\/home/);

    // HRMS card should not show the Locked pill
    const hrmsCard = page.locator('a, div').filter({ hasText: 'HRMS' }).first();
    await expect(hrmsCard).toBeVisible();

    // The other 6 modules should each show a Locked pill
    await expect(page.getByText('Locked', { exact: false })).toHaveCount(6);
  });
});
```

- [ ] **Step 3: Run test to verify it currently passes (this describes existing behavior)**

Run: `npm run seed:test && npx playwright test tests/e2e/auth.spec.ts`
Expected: Both tests PASS. The existing `/home` redesign already implements both behaviors after our prior fixes.

If they fail, debug before proceeding. The smoke baseline must be green before we add any new code.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/fixtures.ts tests/e2e/auth.spec.ts
git commit -m "test(e2e): smoke tests for ADMIN and BRANCH_MANAGER login flows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Claims smoke test

**Files:**
- Create: `tests/e2e/claims.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/claims.spec.ts`:

```ts
import { test, expect, login } from './fixtures';

test.describe('Claims smoke', () => {
  test('ADMIN can open the claims page and submit a basic claim', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/claims');
    await expect(page).toHaveURL(/\/claims/);

    // Locate the "new claim" / "submit" entry point. The page is large; we just
    // assert the page loads and the primary CTA is visible.
    const submitCta = page.getByRole('button', { name: /submit|new claim|create/i }).first();
    await expect(submitCta).toBeVisible({ timeout: 10_000 });
  });
});
```

> Why this is shallow: `app/claims/page.tsx` is 1855 lines with 25 `useState` and many conditional flows. Deeper assertions (filling out a real claim form) are deferred to Step 3l when the file is split into testable components. Step 1's smoke test only asserts the page renders and the primary CTA is reachable.

- [ ] **Step 2: Run the test**

Run: `npx playwright test tests/e2e/claims.spec.ts`
Expected: PASS.

If the CTA selector doesn't match, inspect the page in `--headed` mode and update the selector. Do not stub/mock — the goal is to confirm real render.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/claims.spec.ts
git commit -m "test(e2e): smoke test — claims page renders for ADMIN

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Manpower-schedule smoke test

**Files:**
- Create: `tests/e2e/manpower-schedule.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect, login } from './fixtures';

test.describe('Manpower schedule smoke', () => {
  test('BRANCH_MANAGER (Ampang) can open the schedule page', async ({ page }) => {
    await login(page, 'ampang');
    await page.goto('/manpower-schedule');
    await expect(page).toHaveURL(/\/manpower-schedule/);

    // Page should render without auth redirect.
    await expect(page).not.toHaveURL(/\/login/);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test tests/e2e/manpower-schedule.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/manpower-schedule.spec.ts
git commit -m "test(e2e): smoke test — manpower-schedule loads for BRANCH_MANAGER

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: API auth smoke test

**Files:**
- Create: `tests/e2e/api-auth.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from './fixtures';

test.describe('API auth boundary', () => {
  // These routes are currently unprotected. After Step 1's hardening lands,
  // every one of these should return 401 to an unauthenticated request.
  const protectedAfterStep1 = [
    '/api/attendance-today',
    '/api/hr-dashboard',
    '/api/manpower-cost',
    '/api/sync-medical-leave',
    '/api/test-scanner',
  ];

  for (const path of protectedAfterStep1) {
    test(`${path} returns 401 without a session`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(401);
    });
  }

  test('/api/employees returns 401 without a session', async ({ request }) => {
    const res = await request.get('/api/employees');
    expect(res.status()).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify partial fail**

Run: `npx playwright test tests/e2e/api-auth.spec.ts`
Expected: 5 of 6 tests FAIL with status `200` (the 5 currently-unprotected routes return data instead of 401). `/api/employees` already returns 401 and passes.

This is the failing baseline that Tasks 14–18 will fix.

- [ ] **Step 3: Commit (failing tests committed intentionally)**

```bash
git add tests/e2e/api-auth.spec.ts
git commit -m "test(e2e): api-auth smoke — currently fails for 5 unprotected routes

These tests will pass after Tasks 14–18 lock the routes with requireSession().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: GitHub Actions Playwright workflow

**Files:**
- Create: `.github/workflows/playwright.yml`

- [ ] **Step 1: Create workflow file**

```yaml
name: Playwright Smoke

on:
  pull_request:
    branches: [staging, main]
  push:
    branches: [staging]

jobs:
  smoke:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: ebright_hrfs_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/ebright_hrfs_test?schema=public
      NEXTAUTH_URL: http://localhost:3001
      NEXTAUTH_SECRET: ci-test-secret-not-for-production
      AUTOCOUNT_API_TOKEN: ci-test-token
      PLAYWRIGHT_BASE_URL: http://localhost:3001
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma db push --skip-generate
      - run: npm run seed:test
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

- [ ] **Step 2: Verify locally — workflow YAML parses**

Run: `npx -y @action-validator/cli .github/workflows/playwright.yml || echo "validator not available; skip"`
Expected: validator confirms or is unavailable; either way, proceed. The real validation is GitHub running it on push.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/playwright.yml
git commit -m "ci: add Playwright smoke workflow on PR + push to staging

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Install zod (fix TS error: cannot find module 'zod')

**Files:**
- Modify: `package.json` (no change to dependencies block — zod is already listed; we just need to install)

- [ ] **Step 1: Confirm zod is in package.json but missing from node_modules**

Run: `node -e "require('zod')"`
Expected: error `Cannot find module 'zod'`. (If it succeeds, skip to Step 4.)

- [ ] **Step 2: Reinstall**

Run: `npm install`
Expected: zod and all other declared deps land under `node_modules/`. No new package.json change.

- [ ] **Step 3: Confirm zod resolves**

Run: `node -e "console.log(require('zod').version || 'ok')"`
Expected: prints `ok` or a version string, no error.

- [ ] **Step 4: Verify TS errors for zod are gone**

Run: `npx tsc --noEmit 2>&1 | grep -i zod`
Expected: no output. The two `Cannot find module 'zod'` errors should be resolved.

- [ ] **Step 5: Commit (only package-lock.json may have updated)**

```bash
git add package-lock.json 2>/dev/null || true
git diff --quiet HEAD -- package-lock.json || git commit -m "chore: refresh package-lock to include zod

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If `package-lock.json` was unchanged, no commit needed; just proceed.

---

## Task 10: Exclude `client/` subproject from tsconfig

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Verify the error exists**

Run: `npx tsc --noEmit 2>&1 | grep "client/src"`
Expected: at least one error mentioning `client/src/components/ui/Button.tsx`.

- [ ] **Step 2: Edit tsconfig.json `exclude` array**

Replace:

```json
  "exclude": [
    "node_modules"
  ]
```

with:

```json
  "exclude": [
    "node_modules",
    "client",
    "hr-dashboard"
  ]
```

`client/` is an unrelated subproject (separate React 18 app) shipped in this repo for historical reasons. `hr-dashboard/` is a similar standalone app. Neither belongs in OSC's typecheck scope.

- [ ] **Step 3: Verify the error is gone**

Run: `npx tsc --noEmit 2>&1 | grep "client/src"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "fix(types): exclude client/ and hr-dashboard/ subprojects from typecheck

Both are standalone apps unrelated to OSC; they were dragging unrelated
errors into the OSC typecheck output.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Fix `percent` undefined in offboarding

**Files:**
- Modify: `app/offboarding/page.tsx`

- [ ] **Step 1: Verify error**

Run: `npx tsc --noEmit 2>&1 | grep offboarding`
Expected: `app/offboarding/page.tsx(136,30): error TS18048: 'percent' is possibly 'undefined'.`

- [ ] **Step 2: Edit line 135–137**

Find:

```tsx
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
```

Replace with:

```tsx
              label={({ name, percent }) =>
                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
```

- [ ] **Step 3: Verify error gone**

Run: `npx tsc --noEmit 2>&1 | grep offboarding`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/offboarding/page.tsx
git commit -m "fix(types): guard recharts label percent against undefined

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Clean stale .next cache (fix home-preview ghost errors)

**Files:**
- (build artifact only)

- [ ] **Step 1: Verify the error exists**

Run: `npx tsc --noEmit 2>&1 | grep home-preview`
Expected: 2 errors referencing `.next/types/app/home-preview/page.ts`.

- [ ] **Step 2: Remove the stale cache**

Run: `rm -rf .next`

- [ ] **Step 3: Run typecheck again to confirm errors gone**

Run: `npx tsc --noEmit 2>&1 | grep home-preview`
Expected: no output. (Note: a fresh `npm run dev` or `npm run build` will regenerate `.next/` cleanly.)

- [ ] **Step 4: Final typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors. All 7 original TS errors are now resolved (zod ×2, client/Button, offboarding, home-preview ×2, plus any cascading).

If new errors surface, fix each one inline with the same TDD pattern (verify, edit, verify gone, commit). Do not proceed to Task 13 until typecheck is clean.

- [ ] **Step 5: No commit (build artifact only)**

`.next/` is gitignored.

---

## Task 13: Remove `ignoreBuildErrors` and `ignoreDuringBuilds`

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Edit next.config.ts**

Find:

```ts
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
```

Replace with:

```ts
  // typecheck and lint must pass for the build to succeed.
  // Override only by exception, never by default.
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`
Expected: build completes successfully. If it fails, the cause is a real TS or lint error that was hidden — fix it inline before continuing.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix(build): stop ignoring TypeScript and ESLint errors at build time

The ignore flags were masking real issues. After Tasks 9–12 the build
is now clean; future regressions must be fixed, not ignored.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Replace ESLint config with canonical Next flat config

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `package.json` (already has `eslint-config-next` ^15)

- [ ] **Step 1: Verify current lint is broken**

Run: `npx eslint app/components/DashboardHome.tsx`
Expected: parser error (Unexpected token, can't parse JSX/TS).

- [ ] **Step 2: Install required peer dep**

Run: `npm install --save-dev @eslint/eslintrc`
(Used to bridge legacy Next config into flat config until Next ships native flat support.)

- [ ] **Step 3: Replace eslint.config.mjs**

Replace the entire contents of `eslint.config.mjs` with:

```js
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
      'client/**',
      'hr-dashboard/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
```

- [ ] **Step 4: Verify lint runs**

Run: `npx eslint app/components/DashboardHome.tsx`
Expected: no parser errors. Real lint warnings/errors may surface; fix only the critical ones (errors), defer warnings to Step 4.

- [ ] **Step 5: Run full lint**

Run: `npm run lint`
Expected: completes without parser crashes. Real lint errors may exist — record their count for Step 4 cleanup, but **must be zero** before this Step 1 PR can merge (since Task 13 turned `ignoreDuringBuilds` off).

If real errors block merge, fix them inline now (typically `react/no-unescaped-entities`, `react-hooks/exhaustive-deps`).

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json
git commit -m "fix(lint): canonical Next flat config; ignore client/ and hr-dashboard/

The previous stub couldn't parse JSX or TS. Now extends next/core-web-vitals
and next/typescript via FlatCompat, since eslint-config-next is still RC-style.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Delete dormant scanner-webhook route

**Files:**
- Delete: `app/api/scanner-webhook/route.ts`

- [ ] **Step 1: Confirm zero callers**

Run: `npx grep -r "scanner-webhook" app components lib scripts middleware.ts 2>&1 | grep -v node_modules`
Expected: only the file itself shows up. (Use `grep` if `npx grep` is not available.)

If any caller exists, stop and ask. Do not delete.

- [ ] **Step 2: Delete the file**

```bash
git rm app/api/scanner-webhook/route.ts
```

- [ ] **Step 3: Verify build still passes**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 4: Verify smoke tests still pass**

Run: `npm run seed:test && npx playwright test tests/e2e/auth.spec.ts tests/e2e/claims.spec.ts tests/e2e/manpower-schedule.spec.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: delete dormant scanner-webhook route handler

Confirmed unused — clock events flow via lib/scanner-sync.ts (pull) instead.
Single git commit (9925451e); restore from git history if push integration
is ever wired up later (with HMAC auth, not session auth).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Externalize AutoCount API token

**Files:**
- Modify: `app/api/sync-medical-leave/route.ts`
- Modify: `.env.example`
- Note: deploy-server `.env` must be updated separately by the operator

- [ ] **Step 1: Edit `.env.example`**

Append to `.env.example`:

```
# AutoCount payroll API (set on each environment)
AUTOCOUNT_API_TOKEN="set-in-environment"
```

- [ ] **Step 2: Edit `sync-medical-leave/route.ts`**

Replace lines 8–10 of `app/api/sync-medical-leave/route.ts`:

```ts
const AUTOCOUNT_API_URL =
  "https://payroll.autocountcloud.com/OpenAPILeave/GetLeaveTransactionList?CompanyId=XX51DTWxYwf2IB1rUIi1U7csyyvQcRb0ccaeGcWbjfnzzNMehxSqwz8z%2BpTfNVew";
const AUTOCOUNT_TOKEN = "2HMQNPB7KFYO+2YFJNLGVZHRPWGDQQZHWGNDRCUUAWW=";
```

with:

```ts
const AUTOCOUNT_API_URL =
  "https://payroll.autocountcloud.com/OpenAPILeave/GetLeaveTransactionList?CompanyId=XX51DTWxYwf2IB1rUIi1U7csyyvQcRb0ccaeGcWbjfnzzNMehxSqwz8z%2BpTfNVew";
const AUTOCOUNT_TOKEN = process.env.AUTOCOUNT_API_TOKEN;

if (!AUTOCOUNT_TOKEN) {
  console.error('[sync-medical-leave] AUTOCOUNT_API_TOKEN env var is not set');
}
```

The empty-token branch logs but doesn't crash module load. The existing handler will fail the API call gracefully when the token is missing.

- [ ] **Step 3: Verify build still passes**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 4: Verify the token literal is gone from source**

Run: `grep -r "2HMQNPB7KFYO" app lib scripts 2>&1 | grep -v node_modules`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/api/sync-medical-leave/route.ts .env.example
git commit -m "fix(security): move AutoCount API token to AUTOCOUNT_API_TOKEN env var

Removes hardcoded token from source. Operators must set
AUTOCOUNT_API_TOKEN in deploy environment .env files before next deploy
or the medical leave sync will fail closed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Manual operator step (out of band)**

Operator (you) must:
1. Add `AUTOCOUNT_API_TOKEN=<actual token>` to the staging server `.env` (`/home/deploy/.env` or wherever Docker reads from).
2. Add the same to the production server `.env`.
3. Rotate the token at AutoCount admin if anyone outside the team had access to git history.

Do not deploy this commit to a server that lacks the env var, or medical leave sync will silently fail.

---

## Task 17: requireSession on attendance-today

**Files:**
- Modify: `app/api/attendance-today/route.ts`

- [ ] **Step 1: Run the failing test**

Run: `npx playwright test tests/e2e/api-auth.spec.ts -g "attendance-today"`
Expected: FAIL — currently returns 200, test expects 401.

- [ ] **Step 2: Edit the route**

Replace the entire contents of `app/api/attendance-today/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

// GET /api/attendance-today
// Returns today's AttendanceLog rows — used by Summary dashboard.
// The office scanner-sync script writes these rows every 5s.

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }); // YYYY-MM-DD

    const logs = await prisma.attendanceLog.findMany({
      where: { date: today },
      orderBy: { createdAt: 'desc' },
      select: {
        empNo: true,
        empName: true,
        clockInTime: true,
        clockOutTime: true,
        clockInSerialNo: true,
        clockOutSerialNo: true,
      },
    });

    return NextResponse.json(logs);
  } catch (err) {
    console.error('/api/attendance-today error:', err);
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run the test, expect pass**

Run: `npx playwright test tests/e2e/api-auth.spec.ts -g "attendance-today"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/api/attendance-today/route.ts
git commit -m "fix(security): require session on /api/attendance-today

Was previously open to anonymous reads.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: requireSession on hr-dashboard, manpower-cost, sync-medical-leave, test-scanner

This task batches four near-identical edits to keep the plan tight; engineer must still produce four commits (one per route) so a single bad change can be reverted in isolation.

For each file in the list below:

| # | File |
|---|---|
| a | `app/api/hr-dashboard/route.ts` |
| b | `app/api/manpower-cost/route.ts` |
| c | `app/api/sync-medical-leave/route.ts` |
| d | `app/api/test-scanner/route.ts` |

- [ ] **Step 1: Edit the file**

Find the top of the file. Add immediately after the existing imports (typically below `import { NextResponse } from "next/server";`):

```ts
import { requireSession } from '@/lib/auth';
```

Then for **every exported handler** in that file (`GET`, `POST`, etc.), add the `requireSession()` guard as the first line of the function body, before the existing `try` block:

```ts
export async function GET(/* ...args */) {
  const { error } = await requireSession();
  if (error) return error;

  // ...existing handler body unchanged...
}
```

- [ ] **Step 2: Run the matching smoke test**

Replace `<route>` with the path slug (`hr-dashboard`, `manpower-cost`, `sync-medical-leave`, `test-scanner`):

Run: `npx playwright test tests/e2e/api-auth.spec.ts -g "<route>"`
Expected: PASS for that route.

- [ ] **Step 3: Commit**

```bash
git add app/api/<route>/route.ts
git commit -m "fix(security): require session on /api/<route>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Repeat Steps 1–3 for each of (a) through (d). After all four are committed:

- [ ] **Step 4: Run the full api-auth suite**

Run: `npx playwright test tests/e2e/api-auth.spec.ts`
Expected: all 6 tests PASS (the original 5 unprotected routes + the always-passing employees check).

---

## Task 19: Add `requireRole()` helper to lib/auth.ts

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Edit lib/auth.ts**

Append to the end of the file (after the existing `requireSession` function):

```ts
/**
 * Interim helper. Until Step 3 introduces lib/permissions.ts and lib/tenant.ts,
 * this gives us a 4-line role gate for the three dangerous endpoints.
 *
 * Usage:
 *   const guard = await requireRole(['ADMIN', 'SUPER_ADMIN']);
 *   if (guard.error) return guard.error;
 *   const session = guard.session;
 */
export async function requireRole(allowed: string[]): Promise<AuthResult> {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };

  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !allowed.includes(role)) {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { session, error: null };
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): add requireRole(allowed[]) helper for interim RBAC

Will be superseded by lib/permissions.ts in Step 3 of the modernization
plan, but unblocks Task 20 (admin-only user management endpoints).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: Lock `users` POST/PATCH/DELETE behind ADMIN role

**Files:**
- Modify: `app/api/users/route.ts`

- [ ] **Step 1: Read current handler structure**

The file exports multiple handlers (GET, POST, PUT, PATCH, DELETE). Each currently calls `requireSession()`. We'll add `requireRole(['ADMIN', 'SUPER_ADMIN'])` to all write methods.

- [ ] **Step 2: Edit imports**

In `app/api/users/route.ts`, change:

```ts
import { requireSession } from '@/lib/auth';
```

to:

```ts
import { requireSession, requireRole } from '@/lib/auth';
```

- [ ] **Step 3: Replace `requireSession()` with `requireRole(...)` in POST, PUT, PATCH, DELETE**

For each of the handlers `POST`, `PUT`, `PATCH`, `DELETE` in this file, change the first guard line from:

```ts
  const { session, error } = await requireSession();
  if (error) return error;
```

to:

```ts
  const { session, error } = await requireRole(['ADMIN', 'SUPER_ADMIN']);
  if (error) return error;
```

`GET` keeps `requireSession()` — listing users is allowed for any logged-in user (Step 3 will tighten further).

- [ ] **Step 4: Add a smoke test for the role gate**

Append to `tests/e2e/api-auth.spec.ts`:

```ts
test.describe('Users endpoint role gate', () => {
  test('BRANCH_MANAGER cannot POST to /api/users', async ({ page, request }) => {
    // Establish session via login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test.ampang@ebright.test');
    await page.getByLabel(/password/i).fill('pass1234');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/home/);

    // Forward cookies to a request context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const res = await request.post('/api/users', {
      headers: { cookie: cookieHeader, 'content-type': 'application/json' },
      data: { email: 'noop@ebright.test', password: 'whatever', role: 'BRANCH_MANAGER', branchName: 'Klang' },
    });
    expect(res.status()).toBe(403);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npm run seed:test && npx playwright test tests/e2e/api-auth.spec.ts -g "BRANCH_MANAGER cannot POST"`
Expected: PASS (returns 403).

- [ ] **Step 6: Commit**

```bash
git add app/api/users/route.ts tests/e2e/api-auth.spec.ts
git commit -m "fix(rbac): /api/users POST/PUT/PATCH/DELETE require ADMIN

Adds requireRole helper usage so non-admin sessions get 403 on user
mutation endpoints. GET stays open to any logged-in user pending the
fuller permission model in Step 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: Interim branch scoping on `/api/branch-staff`

**Files:**
- Modify: `app/api/branch-staff/route.ts`

This is interim. Step 3 replaces it with `scopedDb(session)` and a real `tenantId/branchId` foreign key. For now we filter by `session.user.branchName` string match.

- [ ] **Step 1: Read the current file**

Open `app/api/branch-staff/route.ts`. Identify the GET handler — typically `prisma.branchStaff.findMany({...})`.

- [ ] **Step 2: Edit the GET handler**

After the `requireSession()` guard, before the `findMany`, extract the role and branch:

```ts
const role = (session.user as { role?: string }).role;
const branchName = (session.user as { branchName?: string }).branchName;

const where: Parameters<typeof prisma.branchStaff.findMany>[0]['where'] =
  role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'HR'
    ? {}                                  // can see all branches
    : { branch: branchName ?? '__none__' }; // restricted to own branch
```

Then pass `where` into the `findMany` call. Apply the same `where` filter to any other read queries in the file. For write methods (POST/PUT/DELETE) that take a `branch` field in the body, add a check: if not ADMIN/SUPER_ADMIN/HR, the body's `branch` must equal `session.user.branchName`. Otherwise return 403.

Concretely, add this helper at the top of the file (below imports):

```ts
function assertSameBranch(session: { user?: { role?: string; branchName?: string } }, targetBranch: string | undefined): NextResponse | null {
  const role = session.user?.role;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'HR') return null;
  if (targetBranch && targetBranch !== session.user?.branchName) {
    return NextResponse.json({ error: 'Forbidden: cross-branch operation' }, { status: 403 });
  }
  return null;
}
```

Then in POST/PUT/DELETE, after parsing the body, call `assertSameBranch(session, body.branch)` and return its response if non-null.

- [ ] **Step 3: Add smoke test**

Append to `tests/e2e/api-auth.spec.ts`:

```ts
test.describe('Branch-staff branch scoping', () => {
  test('BRANCH_MANAGER (Ampang) does not see Klang staff', async ({ page, request }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test.ampang@ebright.test');
    await page.getByLabel(/password/i).fill('pass1234');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL(/\/home/);

    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const res = await request.get('/api/branch-staff', { headers: { cookie: cookieHeader } });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.staff ?? data.data ?? []);
    expect(list.every((s: { branch?: string }) => s.branch === 'Ampang')).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm run seed:test && npx playwright test tests/e2e/api-auth.spec.ts -g "Ampang"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/branch-staff/route.ts tests/e2e/api-auth.spec.ts
git commit -m "fix(rbac): interim branch scoping on /api/branch-staff

Branch managers and part-timers now only see their own branch's staff
on GET, and cannot mutate other branches' staff via POST/PUT/DELETE.
ADMIN/SUPER_ADMIN/HR retain cross-branch access. This is an interim
filter using session.user.branchName; Step 3 replaces it with the
scopedDb(session) wrapper after tenantId/branchId migrate in.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: Extract `assertSameBranch` helper to lib/auth.ts

**Files:**
- Modify: `lib/auth.ts`
- Modify: `app/api/branch-staff/route.ts`

Task 21 defined `assertSameBranch` locally inside `branch-staff/route.ts`. Before Task 23 reuses it on `/api/employees`, hoist it to `lib/auth.ts` so both routes import the same definition.

- [ ] **Step 1: Append helper to `lib/auth.ts`**

Add at the end of the file:

```ts
type SessionUser = { role?: string; branchName?: string };

/**
 * Returns a 403 NextResponse if the caller's role isn't allowed to act on
 * `targetBranch`. Returns null when the operation is permitted.
 *
 * Permitted roles for cross-branch ops: ADMIN, SUPER_ADMIN, HR.
 * Other roles must have `targetBranch === session.user.branchName`.
 *
 * Interim helper. Step 3 replaces this with scopedDb(session) + can(...).
 */
export function assertSameBranch(
  session: { user?: SessionUser } | null,
  targetBranch: string | undefined,
): NextResponse | null {
  const role = session?.user?.role;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'HR') return null;
  if (targetBranch && targetBranch !== session?.user?.branchName) {
    return NextResponse.json({ error: 'Forbidden: cross-branch operation' }, { status: 403 });
  }
  return null;
}
```

- [ ] **Step 2: Update `branch-staff/route.ts` to import the shared helper**

In `app/api/branch-staff/route.ts`:

1. Delete the local `function assertSameBranch(...)` definition added in Task 21.
2. Update the import line:
   ```ts
   import { requireSession, assertSameBranch } from '@/lib/auth';
   ```

- [ ] **Step 3: Verify typecheck + smoke**

Run: `npx tsc --noEmit && npx playwright test tests/e2e/api-auth.spec.ts -g "Ampang"`
Expected: typecheck clean and the Ampang scoping test still PASSES.

- [ ] **Step 4: Commit**

```bash
git add lib/auth.ts app/api/branch-staff/route.ts
git commit -m "refactor(auth): hoist assertSameBranch into lib/auth.ts

Shared by /api/branch-staff (already) and /api/employees (Task 23).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 23: Interim branch scoping on `/api/employees`

**Files:**
- Modify: `app/api/employees/route.ts`

- [ ] **Step 1: Read the file**

Open `app/api/employees/route.ts`. Identify each exported handler (typically `GET`, `POST`, `PUT`, `DELETE`). Note the field on the `Employee` model used for branch — confirm it's named `branch`.

- [ ] **Step 2: Update imports**

Change:

```ts
import { requireSession } from '@/lib/auth';
```

to:

```ts
import { requireSession, assertSameBranch } from '@/lib/auth';
```

- [ ] **Step 3: Add `where` filter to GET**

Inside the `GET` handler, after the existing `requireSession()` guard, before any `prisma.employee.findMany(...)` call, insert:

```ts
const role = (session.user as { role?: string }).role;
const branchName = (session.user as { branchName?: string }).branchName;
const branchScope =
  role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'HR'
    ? {}                                  // can see all branches
    : { branch: branchName ?? '__none__' }; // restricted to own branch
```

Then merge `branchScope` into every `where` clause used by `prisma.employee.findMany(...)` and `prisma.employee.count(...)` in this handler. Example:

```ts
const employees = await prisma.employee.findMany({
  where: { ...existingWhere, ...branchScope },
  // …rest unchanged
});
```

- [ ] **Step 4: Add `assertSameBranch` to write handlers**

In each of `POST`, `PUT`, `DELETE`, after parsing the request body and after the `requireSession()` guard:

```ts
const guard = assertSameBranch(session, body.branch);
if (guard) return guard;
```

Place this immediately after the body has been validated/destructured. If a write doesn't take a `branch` field (e.g. DELETE by id only), the helper accepts `undefined` and returns null for ADMIN/HR/SUPER_ADMIN; for restricted roles, the operation is allowed only when `branch` is unspecified, which means the existing record's branch must be checked separately. For DELETE-by-id, add this extra guard before deletion:

```ts
const existing = await prisma.employee.findUnique({ where: { id }, select: { branch: true } });
if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
const idGuard = assertSameBranch(session, existing.branch);
if (idGuard) return idGuard;
```

- [ ] **Step 5: Add smoke test**

Append to `tests/e2e/api-auth.spec.ts`:

```ts
test('BRANCH_MANAGER (Klang) does not see Ampang employees', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('test.klang@ebright.test');
  await page.getByLabel(/password/i).fill('pass1234');
  await page.getByRole('button', { name: /sign in|login/i }).click();
  await page.waitForURL(/\/home/);

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const res = await request.get('/api/employees', { headers: { cookie: cookieHeader } });
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.employees ?? data.data ?? []);
  expect(list.every((e: { branch?: string }) => e.branch === 'Klang')).toBeTruthy();
});
```

- [ ] **Step 6: Run the test**

Run: `npm run seed:test && npx playwright test tests/e2e/api-auth.spec.ts -g "Klang"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/employees/route.ts tests/e2e/api-auth.spec.ts
git commit -m "fix(rbac): interim branch scoping on /api/employees

Same pattern as branch-staff: BRANCH_MANAGER and PART_TIME see only
their own branch; ADMIN/HR/SUPER_ADMIN see all. To be replaced by
scopedDb(session) in Step 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 24: Final verification

**Files:**
- (no edits)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero errors. Warnings acceptable.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds. No `ignoreBuildErrors` is in effect (Task 13).

- [ ] **Step 4: Smoke suite**

Run: `npm run seed:test && npx playwright test`
Expected: every test PASSES. The api-auth suite that was committed failing in Task 7 should now be entirely green after Tasks 17–22.

- [ ] **Step 5: Audit token literal removal**

Run: `grep -r "2HMQNPB7KFYO" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next 2>&1`
Expected: no output. The literal must not exist anywhere in the working tree.

- [ ] **Step 6: Audit hardcoded "ignoreBuildErrors"**

Run: `grep -rn "ignoreBuildErrors\|ignoreDuringBuilds" next.config.ts 2>&1`
Expected: no output (or only the ones in comments referring to the removed config).

- [ ] **Step 7: Push branch and open PR**

```bash
git push -u origin refactor/step-1-critical
```

Then on GitHub: open PR `baltoratora/refactor/step-1-critical` → `EbrightOD/staging`. Title: `Step 1: critical security + build`. Use the body template below.

```
## Step 1 of OSC Modernization

Implements §6 Step 1 of the modernization spec.

### What this PR does
- Establishes Playwright smoke suite (5 tests) running in GitHub Actions on every PR.
- Closes 5 unauthenticated route handlers (`requireSession()`).
- Adds interim RBAC: `requireRole()` on `/api/users` mutations; branch scoping on `/api/branch-staff` and `/api/employees`.
- Externalizes AutoCount API token to `AUTOCOUNT_API_TOKEN` env var.
- Deletes dormant `scanner-webhook` route (we pull, don't push).
- Fixes the 7 hidden TypeScript errors and removes `ignoreBuildErrors` / `ignoreDuringBuilds`.
- Replaces broken ESLint flat config with canonical `next/core-web-vitals + next/typescript` setup.

### What it does NOT do
- No folder reorganization (Step 2).
- No schema changes, no multi-tenant migration (Step 3).
- No TanStack Query / Sonner / shadcn (Step 3).

### Operator action required before deploy
Set `AUTOCOUNT_API_TOKEN` in staging and production server `.env` files. Without it, medical leave sync fails closed (logs a warning, does not crash the app).

### Verification
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm run build` — clean
- `npx playwright test` — all green
```

- [ ] **Step 8: Merge to staging only after CI green**

Wait for the GitHub Actions Playwright workflow to finish on the PR. If green, merge to `staging`. Watch the staging deploy run in GitHub Actions. If staging deploy stays green, run a brief manual smoke (login as ADMIN; login as branch manager; submit a claim) on `103.209.156.225:3000`. If clean, merge `staging` → `main` to roll Step 1 to production. Operator must update production `.env` with `AUTOCOUNT_API_TOKEN` **before** the prod merge or medical leave sync breaks until the next deploy.

---

## Self-Review Checklist (engineer to confirm before opening PR)

- [ ] All 24 tasks complete; every checkbox above ticked.
- [ ] No `console.log` was added by this PR (existing ones preserved; cleanup is Step 4).
- [ ] No `any` was added by this PR (existing ones preserved; cleanup is Step 4).
- [ ] No new dependency was added that isn't recorded in `package.json`.
- [ ] `lib/auth.ts` exports `requireSession` and `requireRole` (both used by the routes).
- [ ] Every modified Route Handler still returns the same shape on the success path; only the auth front-matter changed.
- [ ] `scripts/seed-test.ts` deletes-then-inserts (idempotent across reruns).
- [ ] `.env.example` lists `AUTOCOUNT_API_TOKEN` placeholder.
- [ ] `.gitignore` includes `.env.test`, `test-results/`, `playwright-report/`, `playwright/.cache/`.
- [ ] No file references `app/api/scanner-webhook` (deleted).
- [ ] No file contains the literal `2HMQNPB7KFYO+2YFJNLGVZHRPWGDQQZHWGNDRCUUAWW=`.

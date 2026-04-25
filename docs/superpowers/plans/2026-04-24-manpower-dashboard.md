# Manpower Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Manpower Dashboard at `/manpower-schedule/dashboard` that shows class counts per branch / day / slot, filterable by last/this/next week, scoped by role (BM → own branch only; admin → all branches with matrix view).

**Architecture:** New Next.js App Router page + one orchestrator client component + one matrix sub-component. Pure aggregation helpers in `lib/manpowerDashboard.ts` (TDD). Reuses existing `GET /api/schedules`, Prisma models, roles, and `Sidebar` — no API, schema, or auth changes.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, React 18, Tailwind 4, `date-fns`, `next-auth` session, Vitest for unit tests.

**Spec:** [docs/superpowers/specs/2026-04-24-manpower-dashboard-design.md](../specs/2026-04-24-manpower-dashboard-design.md)

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest config with `@/*` path alias matching `tsconfig.json` |
| `lib/manpowerDashboard.ts` | Pure helpers: `getWeekRanges`, `countClassesForSlot`, `countClassesForDay`, `countClassesForWeek`, `isWeekPlanned`, types |
| `lib/__tests__/manpowerDashboard.test.ts` | Vitest unit tests for every exported helper |
| `app/components/ManpowerDashboard.tsx` | Main client component — role detection, week pills, branch tabs, day tabs, per-branch single-day table, empty states |
| `app/components/ManpowerDashboardMatrix.tsx` | Admin-only "All Branches" matrix + status banner |
| `app/manpower-schedule/dashboard/page.tsx` | Thin Suspense-wrapped page route |
| `docs/superpowers/specs/2026-04-24-manpower-dashboard-verification.md` | Manual verification checklist, committed with feature |

**Modify:**

| File | Change |
|---|---|
| `app/manpower-schedule/page.tsx` | Add 4th card "Manpower Dashboard"; adjust grid breakpoint classes |

**Reuse unchanged:**
`app/api/schedules/route.ts`, `app/manpower-schedule/plan-new-week/page.tsx`, `lib/manpowerUtils.ts`, `lib/roles.ts`, `lib/auth.ts`, `app/components/Sidebar.tsx`, `prisma/schema.prisma`.

---

## Conventions

- **Selections key format:** `${day}-${slot}-${columnId}` where `day` is capitalised ("Monday", "Thursday", …), `slot` is the exact string from `getTimeSlotsForDay`, `columnId` is one of `coach1`..`coach5`, `exec1`..`exec5`, or `MANAGER` (uppercase).
- **A "class" counts** when `columnId ∈ {coach1..coach5}` AND value is a non-empty string AND value !== `"None"` AND `!isOpeningClosingSlot(slot, branch)`.
- **Date strings:** always `yyyy-MM-dd`, matching `WeekSelector`.
- **Week boundary:** `weekStartsOn: 1` (Monday).
- **Path alias:** `@/` → project root (see `tsconfig.json`).
- **Commits:** one per task. Messages use imperative mood, <72 chars first line.

---

### Task 1: Set up Vitest config

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `vitest.config.ts` in project root**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'client', 'website-OD'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 2: Verify vitest can discover zero tests without error**

Run: `npm test -- --run`
Expected: Exits 0 with `No test files found` or similar (no config error).

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest config with @/* alias"
```

---

### Task 2: `getWeekRanges` helper (TDD)

**Files:**
- Create: `lib/manpowerDashboard.ts`
- Test: `lib/__tests__/manpowerDashboard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/__tests__/manpowerDashboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getWeekRanges } from '@/lib/manpowerDashboard';

describe('getWeekRanges', () => {
  it('returns last/this/next Mon-Sun ranges for a mid-week day', () => {
    // Wednesday 2026-04-22
    const today = new Date('2026-04-22T10:00:00');
    const { lastWeek, thisWeek, nextWeek } = getWeekRanges(today);
    expect(thisWeek).toEqual({ startDate: '2026-04-20', endDate: '2026-04-26' });
    expect(lastWeek).toEqual({ startDate: '2026-04-13', endDate: '2026-04-19' });
    expect(nextWeek).toEqual({ startDate: '2026-04-27', endDate: '2026-05-03' });
  });

  it('handles Sunday as last day of this week (not next)', () => {
    // Sunday 2026-04-26 at 23:00 — still "this week"
    const today = new Date('2026-04-26T23:00:00');
    const { thisWeek } = getWeekRanges(today);
    expect(thisWeek).toEqual({ startDate: '2026-04-20', endDate: '2026-04-26' });
  });

  it('handles Monday as start of this week (not last)', () => {
    // Monday 2026-04-20 at 00:05
    const today = new Date('2026-04-20T00:05:00');
    const { thisWeek, lastWeek } = getWeekRanges(today);
    expect(thisWeek).toEqual({ startDate: '2026-04-20', endDate: '2026-04-26' });
    expect(lastWeek).toEqual({ startDate: '2026-04-13', endDate: '2026-04-19' });
  });

  it('handles month boundary', () => {
    // Monday 2026-03-30 — next week crosses into April
    const today = new Date('2026-03-30T10:00:00');
    const { nextWeek } = getWeekRanges(today);
    expect(nextWeek).toEqual({ startDate: '2026-04-06', endDate: '2026-04-12' });
  });

  it('handles year boundary', () => {
    // Tuesday 2026-12-29 — next week is in 2027
    const today = new Date('2026-12-29T10:00:00');
    const { nextWeek } = getWeekRanges(today);
    expect(nextWeek).toEqual({ startDate: '2027-01-04', endDate: '2027-01-10' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run lib/__tests__/manpowerDashboard.test.ts`
Expected: FAIL — `Cannot find module '@/lib/manpowerDashboard'`.

- [ ] **Step 3: Create `lib/manpowerDashboard.ts` with minimal implementation**

```ts
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from 'date-fns';

export type WeekRange = {
  startDate: string;
  endDate: string;
};

export type WeekRanges = {
  lastWeek: WeekRange;
  thisWeek: WeekRange;
  nextWeek: WeekRange;
};

function toRange(date: Date): WeekRange {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

export function getWeekRanges(today: Date): WeekRanges {
  return {
    lastWeek: toRange(addWeeks(today, -1)),
    thisWeek: toRange(today),
    nextWeek: toRange(addWeeks(today, 1)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run lib/__tests__/manpowerDashboard.test.ts`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/manpowerDashboard.ts lib/__tests__/manpowerDashboard.test.ts
git commit -m "feat: add getWeekRanges helper for manpower dashboard"
```

---

### Task 3: `countClassesForSlot` helper (TDD)

**Files:**
- Modify: `lib/manpowerDashboard.ts`
- Modify: `lib/__tests__/manpowerDashboard.test.ts`

- [ ] **Step 1: Append failing tests to test file**

Add to the bottom of `lib/__tests__/manpowerDashboard.test.ts`:

```ts
import { countClassesForSlot } from '@/lib/manpowerDashboard';

describe('countClassesForSlot', () => {
  const WEEKDAY_SLOT = '06.00PM - 07.15PM';

  it('returns 0 when selections is empty', () => {
    expect(countClassesForSlot({}, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(0);
  });

  it('counts filled coach cells (coach1..coach5)', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-coach1`]: 'Faizal',
      [`Thursday-${WEEKDAY_SLOT}-coach2`]: 'Aina Nabihah',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(2);
  });

  it('treats "None" and empty string as not filled', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-coach1`]: '',
      [`Thursday-${WEEKDAY_SLOT}-coach2`]: 'None',
      [`Thursday-${WEEKDAY_SLOT}-coach3`]: 'Faizal',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(1);
  });

  it('ignores exec1..exec5 columns', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-exec1`]: 'Danish',
      [`Thursday-${WEEKDAY_SLOT}-exec2`]: 'Irfan',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(0);
  });

  it('ignores MANAGER column', () => {
    const selections = {
      [`Thursday-${WEEKDAY_SLOT}-MANAGER`]: 'Zahid',
    };
    expect(countClassesForSlot(selections, 'Thursday', WEEKDAY_SLOT, 'Ampang')).toBe(0);
  });

  it('returns 0 for opening/closing slots regardless of selections', () => {
    const OPENING = '5:00 PM - 6:00 PM'; // Ampang opening slot
    const selections = {
      [`Thursday-${OPENING}-coach1`]: 'Faizal',
      [`Thursday-${OPENING}-coach2`]: 'Aina Nabihah',
    };
    expect(countClassesForSlot(selections, 'Thursday', OPENING, 'Ampang')).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npm test -- --run lib/__tests__/manpowerDashboard.test.ts`
Expected: FAIL — `countClassesForSlot is not a function` (or similar).

- [ ] **Step 3: Add implementation to `lib/manpowerDashboard.ts`**

Append to `lib/manpowerDashboard.ts`:

```ts
import { isOpeningClosingSlot } from '@/lib/manpowerUtils';

export type SelectionsMap = Record<string, string>;

const COACH_COLUMN_IDS = ['coach1', 'coach2', 'coach3', 'coach4', 'coach5'] as const;

function isFilled(value: string | undefined): boolean {
  if (!value) return false;
  if (value === 'None') return false;
  return true;
}

export function countClassesForSlot(
  selections: SelectionsMap,
  day: string,
  slot: string,
  branch: string,
): number {
  if (isOpeningClosingSlot(slot, branch)) return 0;
  let count = 0;
  for (const col of COACH_COLUMN_IDS) {
    if (isFilled(selections[`${day}-${slot}-${col}`])) count++;
  }
  return count;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run lib/__tests__/manpowerDashboard.test.ts`
Expected: PASS — all tests in both `describe` blocks.

- [ ] **Step 5: Commit**

```bash
git add lib/manpowerDashboard.ts lib/__tests__/manpowerDashboard.test.ts
git commit -m "feat: add countClassesForSlot helper"
```

---

### Task 4: `countClassesForDay`, `countClassesForWeek`, `isWeekPlanned` helpers (TDD)

**Files:**
- Modify: `lib/manpowerDashboard.ts`
- Modify: `lib/__tests__/manpowerDashboard.test.ts`

- [ ] **Step 1: Append failing tests**

Add to `lib/__tests__/manpowerDashboard.test.ts`:

```ts
import {
  countClassesForDay,
  countClassesForWeek,
  isWeekPlanned,
} from '@/lib/manpowerDashboard';

describe('countClassesForDay', () => {
  it('sums countClassesForSlot across all slots of the day', () => {
    const selections = {
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
      'Thursday-06.00PM - 07.15PM-coach2': 'Aina Nabihah',
      'Thursday-07:15PM - 08:30PM-coach1': 'Faizal',
      'Thursday-08.30PM - 09:45PM-coach1': 'Faizal',
    };
    // Ampang weekday slots include three non-opening/closing slots above.
    // Counts: 2 + 1 + 1 = 4.
    expect(countClassesForDay(selections, 'Thursday', 'Ampang')).toBe(4);
  });

  it('returns 0 for a branch that does not run that day', () => {
    // Rimbayu only runs Sat/Sun.
    const selections = {
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
    };
    expect(countClassesForDay(selections, 'Thursday', 'Rimbayu')).toBe(0);
  });

  it('excludes opening/closing slot counts', () => {
    const selections = {
      'Thursday-5:00 PM - 6:00 PM-coach1': 'Faizal', // Ampang opening
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
    };
    expect(countClassesForDay(selections, 'Thursday', 'Ampang')).toBe(1);
  });
});

describe('countClassesForWeek', () => {
  it('sums across all working days for the branch', () => {
    const selections = {
      'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
      'Friday-06.00PM - 07.15PM-coach1': 'Faizal',
      'Saturday-09:15 AM – 10:30 AM-coach1': 'Faizal',
    };
    // Ampang runs Thu/Fri/Sat/Sun: 1 + 1 + 1 + 0 = 3.
    expect(countClassesForWeek(selections, 'Ampang')).toBe(3);
  });

  it('returns 0 when no coach cells are filled', () => {
    const selections = {
      'Thursday-06.00PM - 07.15PM-exec1': 'Danish',
      'Thursday-06.00PM - 07.15PM-MANAGER': 'Zahid',
    };
    expect(countClassesForWeek(selections, 'Ampang')).toBe(0);
  });
});

describe('isWeekPlanned', () => {
  it('returns false when schedule is null', () => {
    expect(isWeekPlanned(null)).toBe(false);
  });

  it('returns false when schedule is undefined', () => {
    expect(isWeekPlanned(undefined)).toBe(false);
  });

  it('returns false when selections has no coach cells', () => {
    expect(
      isWeekPlanned({
        selections: {
          'Thursday-06.00PM - 07.15PM-exec1': 'Danish',
          'Thursday-06.00PM - 07.15PM-MANAGER': 'Zahid',
        },
      }),
    ).toBe(false);
  });

  it('returns false when coach cells are all "None" or empty', () => {
    expect(
      isWeekPlanned({
        selections: {
          'Thursday-06.00PM - 07.15PM-coach1': 'None',
          'Thursday-06.00PM - 07.15PM-coach2': '',
        },
      }),
    ).toBe(false);
  });

  it('returns true when at least one coach cell is filled', () => {
    expect(
      isWeekPlanned({
        selections: {
          'Thursday-06.00PM - 07.15PM-coach1': 'Faizal',
        },
      }),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run lib/__tests__/manpowerDashboard.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Add implementations to `lib/manpowerDashboard.ts`**

Append to `lib/manpowerDashboard.ts`:

```ts
import {
  getTimeSlotsForDay,
  getWorkingDaysForBranch,
} from '@/lib/manpowerUtils';

export function countClassesForDay(
  selections: SelectionsMap,
  day: string,
  branch: string,
): number {
  if (!getWorkingDaysForBranch(branch).includes(day)) return 0;
  const slots = getTimeSlotsForDay(day, branch);
  let total = 0;
  for (const slot of slots) {
    total += countClassesForSlot(selections, day, slot, branch);
  }
  return total;
}

export function countClassesForWeek(
  selections: SelectionsMap,
  branch: string,
): number {
  const days = getWorkingDaysForBranch(branch);
  let total = 0;
  for (const day of days) {
    total += countClassesForDay(selections, day, branch);
  }
  return total;
}

export type SchedulePlanned = { selections: SelectionsMap } | null | undefined;

export function isWeekPlanned(schedule: SchedulePlanned): boolean {
  if (!schedule) return false;
  const { selections } = schedule;
  if (!selections || typeof selections !== 'object') return false;
  for (const key of Object.keys(selections)) {
    if (!/-coach[1-5]$/.test(key)) continue;
    if (isFilled(selections[key])) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run lib/__tests__/manpowerDashboard.test.ts`
Expected: PASS — all ~15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/manpowerDashboard.ts lib/__tests__/manpowerDashboard.test.ts
git commit -m "feat: add day/week class counters and isWeekPlanned predicate"
```

---

### Task 5: Scaffold `ManpowerDashboard` component (role detection + week pills)

**Files:**
- Create: `app/components/ManpowerDashboard.tsx`

- [ ] **Step 1: Create the component with header, role detection, week pills, loading state**

Create `app/components/ManpowerDashboard.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format, parseISO } from "date-fns";
import Sidebar from "@/app/components/Sidebar";
import { isBranchManager } from "@/lib/roles";
import { ALL_BRANCHES } from "@/lib/manpowerUtils";
import {
  getWeekRanges,
  type WeekRange,
  type SelectionsMap,
} from "@/lib/manpowerDashboard";

type ScheduleRow = {
  id: string;
  branch: string;
  startDate: string;
  endDate: string;
  selections: SelectionsMap;
  notes: Record<string, string>;
  status: string;
};

type WeekKey = "lastWeek" | "thisWeek" | "nextWeek";

const WEEK_LABELS: Record<WeekKey, string> = {
  lastWeek: "Last Week",
  thisWeek: "This Week",
  nextWeek: "Next Week",
};

export default function ManpowerDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const userBranch = (session?.user as { branchName?: string } | undefined)?.branchName;
  const isBM = isBranchManager(userRole) && !!userBranch;

  // Computed once per mount — using today at render time.
  const weekRanges = useMemo(() => getWeekRanges(new Date()), []);
  const [weekKey, setWeekKey] = useState<WeekKey>("thisWeek");
  const selectedWeek: WeekRange = weekRanges[weekKey];

  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchSchedules = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch("/api/schedules");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Failed to load");
        if (!cancelled) setSchedules(data.schedules as ScheduleRow[]);
      } catch (err) {
        if (!cancelled) setFetchError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSchedules();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter to the 3 week ranges for current scope
  const relevantSchedules = useMemo(() => {
    const weekStarts = new Set<string>([
      weekRanges.lastWeek.startDate,
      weekRanges.thisWeek.startDate,
      weekRanges.nextWeek.startDate,
    ]);
    return schedules.filter((s) => {
      if (!weekStarts.has(s.startDate)) return false;
      if (isBM && s.branch !== userBranch) return false;
      return true;
    });
  }, [schedules, weekRanges, isBM, userBranch]);

  const headerBranchLabel = isBM ? userBranch : "All Branches";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen((p) => !p)} />

      <main className="flex-1 h-screen flex flex-col overflow-hidden relative">
        {/* Sticky Header */}
        <div className="shrink-0 w-full mx-auto px-6 pt-6 z-50 bg-slate-50">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4 mb-6">
            <button
              onClick={() => router.push("/manpower-schedule")}
              className="bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-md hover:bg-blue-600 transition-colors"
            >
              <span className="text-xl">👥</span>
              <span className="text-base font-black uppercase tracking-wide leading-none">HRMS</span>
            </button>
            <div className="h-8 w-px bg-slate-300" />
            <h1 className="text-lg font-black uppercase tracking-wide text-slate-800 leading-none m-0 flex items-center gap-4">
              <span>Manpower Dashboard — {headerBranchLabel}</span>
              <span className="text-sm bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg font-bold tracking-widest uppercase">
                {format(parseISO(selectedWeek.startDate), "dd MMM yyyy")} – {format(parseISO(selectedWeek.endDate), "dd MMM yyyy")}
              </span>
            </h1>
          </div>

          {/* Week Pills */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4 flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 mr-2">Week:</span>
            {(Object.keys(WEEK_LABELS) as WeekKey[]).map((k) => {
              const range = weekRanges[k];
              const active = k === weekKey;
              return (
                <button
                  key={k}
                  onClick={() => setWeekKey(k)}
                  className={`px-5 py-3 rounded-xl font-black uppercase text-sm tracking-wide transition-all shadow-sm flex flex-col items-center ${
                    active
                      ? "bg-[#2D3F50] text-white shadow-lg scale-105"
                      : "bg-white text-slate-600 border-2 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{WEEK_LABELS[k]}</span>
                  <span className={`text-[9px] font-bold mt-1 ${active ? "text-slate-300" : "text-slate-400"}`}>
                    {format(parseISO(range.startDate), "dd MMM")} – {format(parseISO(range.endDate), "dd MMM")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrolling Body */}
        <div className="flex-1 overflow-y-auto w-full mx-auto px-6 pb-12">
          {loading ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
              Loading schedules…
            </div>
          ) : fetchError ? (
            <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center justify-between">
              <span className="text-red-700 font-bold">Couldn&apos;t load schedules. {fetchError}</span>
              <button
                onClick={() => window.location.reload()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold uppercase text-xs"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-slate-500 font-bold uppercase tracking-widest text-sm p-6">
              {relevantSchedules.length} schedule(s) for {WEEK_LABELS[weekKey]}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit`
Expected: no new errors attributable to `app/components/ManpowerDashboard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/ManpowerDashboard.tsx
git commit -m "feat: scaffold ManpowerDashboard component with week pills"
```

---

### Task 6: Create dashboard page route

**Files:**
- Create: `app/manpower-schedule/dashboard/page.tsx`

- [ ] **Step 1: Create the page wrapper**

Create `app/manpower-schedule/dashboard/page.tsx`:

```tsx
"use client";

import { Suspense } from "react";
import ManpowerDashboard from "@/app/components/ManpowerDashboard";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <ManpowerDashboard />
    </Suspense>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Smoke test in dev server**

Run: `npm run dev` in a separate terminal.
Open `http://localhost:3000/manpower-schedule/dashboard` while logged in.
Expected: Page loads, shows header with "Manpower Dashboard — All Branches" (if admin) or "— {branch}" (if BM), three week pills, and the placeholder "N schedule(s) for This Week" text under the pills. No console errors.
Stop the dev server before continuing.

- [ ] **Step 4: Commit**

```bash
git add app/manpower-schedule/dashboard/page.tsx
git commit -m "feat: add /manpower-schedule/dashboard page route"
```

---

### Task 7: Add branch tabs + per-branch day view

**Files:**
- Modify: `app/components/ManpowerDashboard.tsx`

- [ ] **Step 1: Replace the placeholder body with branch tabs, day tabs, and the single-day table**

In `app/components/ManpowerDashboard.tsx`:

a) Add these imports at the top (merge into existing imports):

```tsx
import {
  COLUMNS,
  getStaffColorByIndex,
  getTimeSlotsForDay,
  getWorkingDaysForBranch,
  isOpeningClosingSlot,
} from "@/lib/manpowerUtils";
import {
  countClassesForDay,
  countClassesForSlot,
  countClassesForWeek,
  isWeekPlanned,
} from "@/lib/manpowerDashboard";
```

b) After the `headerBranchLabel` line, add state for branch tab and day tab:

```tsx
const [branchTab, setBranchTab] = useState<string>("__ALL__");
// For BMs, force branchTab to their own branch on session load
useEffect(() => {
  if (isBM && userBranch) setBranchTab(userBranch);
}, [isBM, userBranch]);

const showingAllBranches = !isBM && branchTab === "__ALL__";
const activeBranch = isBM ? (userBranch as string) : branchTab;

const activeBranchSchedule = useMemo(() => {
  if (showingAllBranches) return null;
  return (
    relevantSchedules.find(
      (s) => s.branch === activeBranch && s.startDate === selectedWeek.startDate,
    ) ?? null
  );
}, [relevantSchedules, activeBranch, selectedWeek.startDate, showingAllBranches]);

const workingDays = useMemo(
  () => (showingAllBranches ? [] : getWorkingDaysForBranch(activeBranch)),
  [showingAllBranches, activeBranch],
);

const [selectedDay, setSelectedDay] = useState<string>("");
useEffect(() => {
  if (!showingAllBranches && workingDays.length > 0 && !workingDays.includes(selectedDay)) {
    setSelectedDay(workingDays[0]);
  }
}, [showingAllBranches, workingDays, selectedDay]);
```

c) Replace the scrolling body section (`{loading ? … : fetchError ? … : <placeholder text> }`) with:

```tsx
{loading ? (
  <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
    Loading schedules…
  </div>
) : fetchError ? (
  <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex items-center justify-between">
    <span className="text-red-700 font-bold">Couldn&apos;t load schedules. {fetchError}</span>
    <button
      onClick={() => window.location.reload()}
      className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold uppercase text-xs"
    >
      Retry
    </button>
  </div>
) : (
  <>
    {/* Branch Tabs (admin only) */}
    {!isBM && (
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setBranchTab("__ALL__")}
          className={`px-4 py-2 rounded-xl font-black uppercase text-xs tracking-wide transition-all shadow-sm ${
            branchTab === "__ALL__"
              ? "bg-[#2D3F50] text-white"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Branches
        </button>
        {ALL_BRANCHES.map((b) => (
          <button
            key={b}
            onClick={() => setBranchTab(b)}
            className={`px-4 py-2 rounded-xl font-black uppercase text-xs tracking-wide transition-all shadow-sm ${
              branchTab === b
                ? "bg-[#2D3F50] text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {b}
          </button>
        ))}
      </div>
    )}

    {showingAllBranches ? (
      <div className="text-slate-500 font-bold uppercase tracking-widest text-sm p-6">
        All Branches matrix — coming in the next task
      </div>
    ) : !isWeekPlanned(activeBranchSchedule) ? (
      <div className="text-slate-500 font-bold uppercase tracking-widest text-sm p-6">
        Empty state — coming in the next task
      </div>
    ) : (
      <PerBranchView
        schedule={activeBranchSchedule!}
        branch={activeBranch}
        workingDays={workingDays}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
      />
    )}
  </>
)}
```

d) Add the `PerBranchView` sub-component at the bottom of the file (outside the default export):

```tsx
function PerBranchView({
  schedule,
  branch,
  workingDays,
  selectedDay,
  setSelectedDay,
}: {
  schedule: ScheduleRow;
  branch: string;
  workingDays: string[];
  selectedDay: string;
  setSelectedDay: (d: string) => void;
}) {
  const day = selectedDay;
  const slots = day ? getTimeSlotsForDay(day, branch) : [];
  const dayTotal = day ? countClassesForDay(schedule.selections, day, branch) : 0;
  const weekTotal = countClassesForWeek(schedule.selections, branch);

  const coachNamesForSlot = (slot: string): string[] => {
    const names: string[] = [];
    for (const col of COLUMNS) {
      if (col.type !== "coach") continue;
      const v = schedule.selections[`${day}-${slot}-${col.id}`];
      if (v && v !== "None") names.push(v);
    }
    return names;
  };

  const managerForSlot = (slot: string): string => {
    const v = schedule.selections[`${day}-${slot}-MANAGER`];
    return v && v !== "None" ? v : "";
  };

  // Colour chip helper — derive a stable staff list for colouring
  const allNames = useMemoStaffList(schedule.selections);

  return (
    <div className="space-y-4">
      {/* Day Tabs */}
      <div className="flex gap-2 flex-wrap">
        {workingDays.map((d) => {
          const active = d === selectedDay;
          return (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-6 py-3 rounded-xl font-black uppercase text-sm tracking-wide transition-all shadow-sm ${
                active
                  ? "bg-[#2D3F50] text-white shadow-lg scale-105"
                  : "bg-white text-slate-500 border-2 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {d.slice(0, 3)}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {day && (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <header className="bg-white p-4 border-b flex items-center justify-between">
            <h2 className="text-xl font-black uppercase text-slate-800 m-0">{day}</h2>
            <span className="text-xs font-black uppercase tracking-widest text-slate-500">
              Day total: {dayTotal} class{dayTotal === 1 ? "" : "es"}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
              <thead className="bg-[#2D3F50] text-white text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="p-3 text-left w-[180px]">Time Slot</th>
                  <th className="p-3 text-left w-[160px]">Manager on Duty</th>
                  <th className="p-3 text-left">Coaches</th>
                  <th className="p-3 text-right w-[100px]">Classes</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => {
                  const isOpenClose = isOpeningClosingSlot(slot, branch);
                  if (isOpenClose) {
                    return (
                      <tr key={slot} className="border-b bg-blue-50">
                        <td className="p-3 font-bold text-xs text-slate-900">{slot}</td>
                        <td colSpan={3} className="p-3 text-center">
                          <span className="inline-flex items-center gap-2 bg-blue-600 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                            All Staff — Executive
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  const mgr = managerForSlot(slot);
                  const coaches = coachNamesForSlot(slot);
                  const count = countClassesForSlot(schedule.selections, day, slot, branch);
                  return (
                    <tr key={slot} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-bold text-xs text-slate-900">{slot}</td>
                      <td className="p-3">
                        {mgr ? (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStaffColorByIndex(mgr, allNames)}`}>
                            {mgr}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {coaches.length === 0 ? (
                            <span className="text-slate-300 text-xs">—</span>
                          ) : (
                            coaches.map((name) => (
                              <span
                                key={name}
                                className={`inline-block px-2 py-1 rounded text-xs font-bold ${getStaffColorByIndex(name, allNames)}`}
                              >
                                {name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right text-sm font-black text-slate-800">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 text-right">
        <span className="text-sm font-black uppercase tracking-widest text-slate-800">
          Week total: {weekTotal} class{weekTotal === 1 ? "" : "es"}
        </span>
      </div>
    </div>
  );
}

// Build a stable ordered list of staff names appearing in this schedule's
// selections, so getStaffColorByIndex assigns consistent colours per name.
function useMemoStaffList(selections: SelectionsMap): string[] {
  return useMemo(() => {
    const set = new Set<string>();
    for (const v of Object.values(selections)) {
      if (v && v !== "None") set.add(v);
    }
    return Array.from(set);
  }, [selections]);
}
```

e) Add `useMemo` to the React import at the top if not already present (it's already imported as part of `useMemo`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` in a separate terminal. Open `http://localhost:3000/manpower-schedule/dashboard` logged in as admin.

Expected:
- Branch tabs visible (`[All Branches] [Ampang] …`)
- Clicking any branch with an existing planned week for "This Week" shows the day tabs + populated slot table
- Clicking "All Branches" still shows placeholder "coming in the next task"
- Clicking a week pill updates the active dataset
- No console errors

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/components/ManpowerDashboard.tsx
git commit -m "feat: add branch tabs and per-branch day view to dashboard"
```

---

### Task 8: Empty state card

**Files:**
- Modify: `app/components/ManpowerDashboard.tsx`

- [ ] **Step 1: Replace the per-branch empty state placeholder**

In `app/components/ManpowerDashboard.tsx`, find:

```tsx
    ) : !isWeekPlanned(activeBranchSchedule) ? (
      <div className="text-slate-500 font-bold uppercase tracking-widest text-sm p-6">
        Empty state — coming in the next task
      </div>
```

Replace with:

```tsx
    ) : !isWeekPlanned(activeBranchSchedule) ? (
      <EmptyStateCard
        weekKey={weekKey}
        branch={activeBranch}
        range={selectedWeek}
        isBM={isBM}
      />
```

- [ ] **Step 2: Add the `EmptyStateCard` sub-component at the bottom of the file**

```tsx
function EmptyStateCard({
  weekKey,
  branch,
  range,
  isBM,
}: {
  weekKey: WeekKey;
  branch: string;
  range: WeekRange;
  isBM: boolean;
}) {
  const showCTA = isBM && weekKey !== "lastWeek";
  let heading: string;
  let body: string;
  if (weekKey === "lastWeek") {
    heading = "📭 No data recorded";
    body = "No data was recorded for last week.";
  } else if (isBM && weekKey === "nextWeek") {
    heading = "📝 Not planned yet";
    body = "Next week's manpower hasn't been planned. BMs should plan 2 weeks ahead.";
  } else if (isBM && weekKey === "thisWeek") {
    heading = "📝 Not planned yet";
    body = "This week wasn't planned. Plan it now to track attendance.";
  } else {
    heading = "📝 Not planned yet";
    body = `${branch} hasn't planned this week yet.`;
  }

  const ctaHref = `/manpower-schedule/plan-new-week?start=${range.startDate}&end=${range.endDate}`;
  const ctaLabel = weekKey === "nextWeek" ? "Plan Next Week Now →" : "Plan This Week Now →";

  return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-white p-10 rounded-[2rem] shadow-xl border border-slate-100 text-center max-w-md w-full">
        <h2 className="text-2xl font-black text-slate-800 mb-3 uppercase tracking-tight">{heading}</h2>
        <p className="text-slate-600 mb-6">{body}</p>
        {showCTA && (
          <a
            href={ctaHref}
            className="inline-block w-full py-4 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 uppercase tracking-widest transition-colors shadow-md"
          >
            {ctaLabel}
          </a>
        )}
        <p className="mt-4 text-xs text-slate-400 font-bold uppercase tracking-widest">
          {range.startDate} – {range.endDate} (Mon – Sun)
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`. Logged in as BM:
- "This Week" pill, if BM hasn't planned → empty card with "Plan This Week Now →" button
- Click the button → lands on `/manpower-schedule/plan-new-week` with week pre-confirmed, branch auto-selected
- "Next Week" pill → empty card mentions "plan 2 weeks ahead"
- "Last Week" pill (if no data) → empty card with no CTA button

Logged in as admin, pick a branch with no schedule for the week:
- Empty card says `"{branch} hasn't planned this week yet."` with no CTA

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/components/ManpowerDashboard.tsx
git commit -m "feat: add empty-state card with role-aware CTA"
```

---

### Task 9: `ManpowerDashboardMatrix` — All Branches view

**Files:**
- Create: `app/components/ManpowerDashboardMatrix.tsx`
- Modify: `app/components/ManpowerDashboard.tsx`

- [ ] **Step 1: Create the matrix component**

Create `app/components/ManpowerDashboardMatrix.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { ALL_BRANCHES, DAYS, getWorkingDaysForBranch } from "@/lib/manpowerUtils";
import {
  countClassesForDay,
  countClassesForWeek,
  isWeekPlanned,
  type SelectionsMap,
} from "@/lib/manpowerDashboard";

type ScheduleRow = {
  branch: string;
  startDate: string;
  selections: SelectionsMap;
};

export default function ManpowerDashboardMatrix({
  schedules,
  weekStart,
  onBranchClick,
}: {
  schedules: ScheduleRow[];
  weekStart: string;
  onBranchClick: (branch: string) => void;
}) {
  const dayList = useMemo(() => [...DAYS], []);

  const rows = useMemo(() => {
    return ALL_BRANCHES.map((branch) => {
      const schedule = schedules.find((s) => s.branch === branch && s.startDate === weekStart);
      const planned = isWeekPlanned(schedule ?? null);
      const workingDays = getWorkingDaysForBranch(branch);
      const perDay: Record<string, number | null> = {};
      let total = 0;
      for (const d of dayList) {
        if (!workingDays.includes(d)) {
          perDay[d] = null; // render as —
          continue;
        }
        const count = schedule ? countClassesForDay(schedule.selections, d, branch) : 0;
        perDay[d] = count;
        total += count;
      }
      return { branch, planned, perDay, total };
    });
  }, [schedules, weekStart, dayList]);

  const networkTotalsPerDay = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const d of dayList) {
      totals[d] = rows.reduce((sum, r) => sum + (r.perDay[d] ?? 0), 0);
    }
    return totals;
  }, [rows, dayList]);

  const networkWeekTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const plannedCount = rows.filter((r) => r.planned).length;
  const totalBranches = rows.length;

  const bannerClass =
    plannedCount === totalBranches
      ? "bg-green-50 border-green-200 text-green-800"
      : plannedCount === 0
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-yellow-50 border-yellow-200 text-yellow-800";
  const bannerText =
    plannedCount === totalBranches
      ? `✅ All ${totalBranches} branches planned for this week`
      : plannedCount === 0
        ? "🔴 No branches have planned this week yet"
        : `⚠️ ${plannedCount} of ${totalBranches} branches planned — ${totalBranches - plannedCount} outstanding`;

  return (
    <div className="space-y-4">
      <div className={`border rounded-2xl p-4 font-bold ${bannerClass}`}>{bannerText}</div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
            <thead className="bg-[#2D3F50] text-white text-[10px] uppercase tracking-widest">
              <tr>
                <th className="p-3 text-left w-[220px]">Branch</th>
                {dayList.map((d) => (
                  <th key={d} className="p-3 text-center">{d.slice(0, 3)}</th>
                ))}
                <th className="p-3 text-right w-[140px]">Week Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.branch}
                  onClick={() => onBranchClick(r.branch)}
                  className={`border-b cursor-pointer transition-colors ${
                    r.planned ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <td className="p-3 font-bold text-sm text-slate-800">{r.branch}</td>
                  {dayList.map((d) => (
                    <td key={d} className="p-3 text-center text-sm font-medium">
                      {r.perDay[d] === null ? "—" : r.perDay[d]}
                    </td>
                  ))}
                  <td className="p-3 text-right text-sm font-black text-slate-800">
                    {r.planned ? (
                      r.total
                    ) : (
                      <span className="inline-block px-2 py-1 rounded bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest">
                        Not planned
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100">
              <tr>
                <td className="p-3 font-black uppercase text-xs tracking-widest text-slate-800">Network total</td>
                {dayList.map((d) => (
                  <td key={d} className="p-3 text-center font-black text-slate-800">
                    {networkTotalsPerDay[d]}
                  </td>
                ))}
                <td className="p-3 text-right font-black text-slate-800">{networkWeekTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

```

- [ ] **Step 2: Wire it into `ManpowerDashboard.tsx`**

In `app/components/ManpowerDashboard.tsx`:

a) Add import:

```tsx
import ManpowerDashboardMatrix from "@/app/components/ManpowerDashboardMatrix";
```

b) Replace the "All Branches matrix — coming in the next task" block:

```tsx
{showingAllBranches ? (
  <ManpowerDashboardMatrix
    schedules={relevantSchedules}
    weekStart={selectedWeek.startDate}
    onBranchClick={(b) => setBranchTab(b)}
  />
```

(Leave the following `) : !isWeekPlanned(activeBranchSchedule) ? (` branches untouched.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

`npm run dev`, logged in as admin, open `/manpower-schedule/dashboard`:
- "All Branches" tab active → matrix renders with all 20 branches
- Status banner at top reflects `X of 20 branches planned` with correct colour
- Non-working-day cells show `—`, not `0`
- Unplanned branches greyed, Week Total shows `Not planned` pill
- Click a branch row → tab switches to that branch, same week pill stays active
- Footer row shows Network totals

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/components/ManpowerDashboardMatrix.tsx app/components/ManpowerDashboard.tsx
git commit -m "feat: add All Branches matrix view to dashboard"
```

---

### Task 10: Add 4th card to manpower hub

**Files:**
- Modify: `app/manpower-schedule/page.tsx`

- [ ] **Step 1: Update the grid container class logic**

In `app/manpower-schedule/page.tsx`, find the line:

```tsx
          <div className={`w-full grid grid-cols-1 ${hasHistory ? 'md:grid-cols-3' : 'md:grid-cols-1 max-w-md'} gap-8 text-slate-800`}>
```

Replace with:

```tsx
          <div className={`w-full grid grid-cols-1 ${hasHistory ? 'md:grid-cols-4' : 'md:grid-cols-2 max-w-2xl'} gap-8 text-slate-800`}>
```

- [ ] **Step 2: Add the Dashboard card**

Locate the closing of the Plan New Week `div` (first card). The next thing in the file is the `{hasHistory && ( <>`. Insert the Dashboard card BEFORE that fragment so it appears outside the `hasHistory` gate (always visible):

Replace:

```tsx
            <div onClick={() => router.push("/manpower-schedule/plan-new-week")} className="bg-white p-10 rounded-3xl shadow-xl border-4 border-transparent hover:border-green-500 cursor-pointer transition-all flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:bg-green-600 group-hover:text-white transition-all">✍️</div>
              <h2 className="text-2xl font-bold tracking-tight uppercase">Plan New Week</h2>
            </div>

            {hasHistory && (
```

With:

```tsx
            <div onClick={() => router.push("/manpower-schedule/plan-new-week")} className="bg-white p-10 rounded-3xl shadow-xl border-4 border-transparent hover:border-green-500 cursor-pointer transition-all flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:bg-green-600 group-hover:text-white transition-all">✍️</div>
              <h2 className="text-2xl font-bold tracking-tight uppercase">Plan New Week</h2>
            </div>

            {/* Dashboard — always visible so BMs land on the empty-state nudge */}
            <div onClick={() => router.push("/manpower-schedule/dashboard")} className="bg-white p-10 rounded-3xl shadow-xl border-4 border-transparent hover:border-purple-500 cursor-pointer transition-all flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 text-3xl group-hover:bg-purple-600 group-hover:text-white transition-all">📊</div>
              <h2 className="text-2xl font-bold tracking-tight uppercase">Manpower Dashboard</h2>
            </div>

            {hasHistory && (
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual smoke test**

`npm run dev`, open `/manpower-schedule`:
- Four cards visible (if user has history): Plan New Week, Dashboard, Update, Archive
- Two cards visible (no history): Plan New Week, Dashboard — both in a 2-column layout, centred
- Click Dashboard → navigates to `/manpower-schedule/dashboard`

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/manpower-schedule/page.tsx
git commit -m "feat: add Manpower Dashboard card to manpower hub"
```

---

### Task 11: Manual verification checklist document

**Files:**
- Create: `docs/superpowers/specs/2026-04-24-manpower-dashboard-verification.md`

- [ ] **Step 1: Create the checklist file**

```markdown
# Manpower Dashboard — Manual Verification Checklist

Run through this before declaring the feature done.

## Role scoping
- [ ] Log in as an admin account → dashboard shows branch-tabs row with "All Branches" first
- [ ] Log in as a BM (branch = Ampang) → dashboard title reads "Manpower Dashboard — Ampang", no branch-tabs row

## Week filter
- [ ] "This Week" pill active by default
- [ ] Date range under each pill matches actual Mon–Sun of the target week in local time
- [ ] Clicking Last / Next week updates the per-branch table, matrix, and header date-pill

## Per-branch view (BM or admin drilled in)
- [ ] Day tabs show only the branch's working days (e.g. Rimbayu → Sat/Sun only)
- [ ] Select any slot → cross-check coach names in Plan New Week; dashboard count matches number of non-empty coach cells
- [ ] Opening/closing rows render with "All Staff — Executive" pill and no count
- [ ] "Day total" and "Week total" appear and match hand-count

## Empty states
- [ ] BM, week with no submitted schedule → empty card shows with appropriate copy
- [ ] BM, Next Week → CTA reads "Plan Next Week Now →"
- [ ] BM, This Week → CTA reads "Plan This Week Now →"
- [ ] BM, Last Week → no CTA button
- [ ] Click CTA → lands on `/manpower-schedule/plan-new-week` with week pre-confirmed, branch auto-selected (no Select Week / Select Branch step)
- [ ] Admin, drilled into unplanned branch → empty card, no CTA button

## All Branches matrix (admin)
- [ ] Banner colour correct: green if all planned, yellow if partial, red if none
- [ ] Banner text says accurate "X of N branches planned"
- [ ] Non-working-day cells show `—`, not `0`
- [ ] Unplanned rows greyed; Week Total shows "Not planned" pill
- [ ] Click a branch row → switches to that branch tab, same week still selected
- [ ] Network total row sums correctly

## Edge cases
- [ ] Set system clock to 2026-12-30 → Next Week pill range crosses into Jan 2027
- [ ] Load dashboard with empty database (no schedules at all) → no crashes; banner says "0 of N"; all branches show as Not planned

## Tests
- [ ] `npm test` passes with all dashboard helper tests green
- [ ] `npx tsc --noEmit` passes with no new errors
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-24-manpower-dashboard-verification.md
git commit -m "docs: add manpower dashboard verification checklist"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: all dashboard tests pass, no new failures.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new errors in modified/created files.

- [ ] **Step 4: Walk through `docs/superpowers/specs/2026-04-24-manpower-dashboard-verification.md` end to end**

Start `npm run dev`. Tick every box. Fix anything that fails before declaring done.

Common fixes if something breaks:
- Blank dashboard / "Loading…" forever: check browser console + `npm run dev` terminal for `/api/schedules` errors. If 401 → user not logged in. If 500 → database/schema issue (out of scope for this plan).
- Count mismatch: inspect `schedule.selections` JSON in React DevTools; verify the `day-slot-coachN` keys match exactly (case-sensitive) what Plan New Week writes.
- CTA lands on Select Week / Select Branch: verify the URL has `?start=...&end=...`; check `plan-new-week/page.tsx` `useEffect` on `startDateStr`/`endDateStr`.

- [ ] **Step 5: Commit the completed checklist file if any boxes were annotated**

```bash
git add -u docs/superpowers/specs/2026-04-24-manpower-dashboard-verification.md 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore: record manpower dashboard verification run"
```

---

## Self-review checks (engineer-side after completion)

Before opening a PR:

1. **Every spec section covered?**
   - Architecture & data flow → Tasks 5, 6
   - Counting logic → Tasks 3, 4
   - UI layout (per-branch) → Task 7
   - UI layout (All Branches matrix) → Task 9
   - Empty states → Task 8
   - Role scoping → Task 5 (role detection), Task 7 (tabs), Task 8 (CTA gating)
   - Week filter semantics → Tasks 2, 5
   - Testing → Tasks 2, 3, 4, 11, 12
   - Hub card → Task 10

2. **No `any` added?** Helpers use `SelectionsMap = Record<string, string>`. Component uses narrow `ScheduleRow` type. Do not widen to `any` without a comment explaining why.

3. **No `.env`, credentials, or DB files in the diff?** `git diff --stat main` — verify only the files in the file manifest appear.

4. **Frequent commits?** Each task commits at its end. Do not batch.

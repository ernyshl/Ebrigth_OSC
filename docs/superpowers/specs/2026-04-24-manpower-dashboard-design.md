# Manpower Dashboard — Design Spec

**Date:** 2026-04-24
**Owner:** dina (od@ebright.my)
**Status:** Draft, awaiting user review

## Goal

Give Branch Managers (BMs) and admins a read-only overview of planned classes per branch, per day, per time slot, filterable by last / this / next week. The dashboard makes 2-weeks-ahead planning *visible* without hard-enforcing it in Plan New Week, so unplanned weeks become socially and operationally obvious.

## Why this ordering (dashboard before the 2-weeks-ahead rule)

The dashboard reads whatever schedule data exists; it does not require Plan New Week to enforce a deadline. The empty state (`"Next week not planned yet — [Plan Next Week Now →]"`) plus the admin-side `"X of 20 branches planned"` banner is itself the enforcement surface. After shipping this and observing 1–2 weeks of behaviour, the team can decide whether a hard rule in Plan New Week is still needed. If it is, that becomes a separate spec.

## Users and scope

- **Branch Manager (BM):** auto-scoped to their own branch via `session.user.branchName`. Cannot view other branches. Sees week filter + day tabs + slot table for their branch only.
- **Admin / Super-admin:** sees `[All Branches | AMP | Seri Putra | …]` tabs above the same UI. "All Branches" is a per-day × per-branch matrix (see below).
- **Other authenticated roles (HOD, Executive, etc.):** treated as admin-style read-only viewers — see the branch-tab row and All Branches matrix, but no empty-state CTAs (they can't act on "Plan Next Week"). This matches `MANAGEMENT_ROLES` in [lib/roles.ts](lib/roles.ts) and keeps behaviour consistent with how Plan New Week already handles these roles.
- **Unauthenticated users:** blocked upstream by `requireSession` on the reused `/api/schedules` endpoint.

### Non-goals

- Editing schedules from the dashboard (use Plan New Week)
- Hard enforcement of 2-weeks-ahead planning
- Notifications / email reminders ("Contact BM" via `mailto:` is acceptable; no notification backend)
- Per-coach workload views (that's the Weekly Hours Summary in Plan New Week)
- Historical analytics beyond `last / this / next` week

## Architecture

### Route and files

**New:**
- `app/manpower-schedule/dashboard/page.tsx` — thin `Suspense` wrapper, same shape as `plan-new-week/page.tsx`
- `app/components/ManpowerDashboard.tsx` — the main renderer (tabs, table, empty states)
- `lib/manpowerDashboard.ts` — pure helpers: `countClassesForSlot`, `countClassesForDay`, `countClassesForWeek`, `isWeekPlanned`, `getWeekRanges`
- `lib/__tests__/manpower-dashboard.test.ts` — unit tests for the pure helpers

**Modified:**
- `app/manpower-schedule/page.tsx` — add a 4th card "Manpower Dashboard" (icon 📊). The card appears regardless of `hasHistory` so BMs hit the empty state and are nudged back into Plan New Week. Grid class changes:
  - `!hasHistory` → `md:grid-cols-2 max-w-2xl` (2 cards: Plan New Week + Dashboard)
  - `hasHistory`  → `md:grid-cols-4` (4 cards: Plan New Week + Update + Archive + Dashboard)

### API

Reuse `GET /api/schedules` unchanged. It already returns `{ id, branch, startDate, endDate, selections, notes, status }[]` and is behind `requireSession`. No new endpoint, no new params.

Client-side aggregation is fine at current scale: ~20 branches × up to 3 week records = ≤60 rows of JSON per page load.

### Data flow

1. Page mounts. Read `session.user.role` and `session.user.branchName`.
2. Compute the three week ranges (last / this / next) from today using `date-fns`:
   - `startDate = format(startOfWeek(target, { weekStartsOn: 1 }), 'yyyy-MM-dd')`
   - `endDate = format(endOfWeek(target, { weekStartsOn: 1 }), 'yyyy-MM-dd')`
   - This matches `WeekSelector` so `startDate` strings align with existing `ManpowerSchedule.startDate` records.
3. Fetch `/api/schedules` once on mount.
4. Filter client-side: keep only schedules whose `startDate` is one of the three week ranges; if BM, also filter to `branch === session.user.branchName`.
5. User interactions (week pill, branch tab, day tab) are pure re-renders over the in-memory data — no refetch.

## Counting logic

### Definition

One class = one filled coach cell in `selections`.

```
classCount(schedule, day, slot) =
  if isOpeningClosingSlot(slot, schedule.branch) → 0
  else count of colId ∈ ["coach1","coach2","coach3","coach4","coach5"]
       where schedule.selections[`${day}-${slot}-${colId}`] is a non-empty string
       and that string is not "None"
```

Explicitly excluded: `exec1`..`exec5`, `MANAGER`, opening/closing slots, selections equal to `""`, `undefined`, or the literal `"None"`.

### Week total per branch

Sum of `classCount` across all `(day, slot)` pairs where `day ∈ getWorkingDaysForBranch(branch)` and `slot ∈ getTimeSlotsForDay(day, branch)`.

### "All Branches" aggregation

Because `getTimeSlotsForDay` and `getWorkingDaysForBranch` vary by branch, per-slot summing across branches is misleading. The All Branches view drops slot resolution:

- **Rows:** branches (sorted alphabetically, same as `ALL_BRANCHES`).
- **Columns:** `Wed | Thu | Fri | Sat | Sun | Week Total`.
- **Cells:** total classes for that branch on that day (`countClassesForDay`). If the branch does not run that day per `BRANCH_WORKING_DAYS`, render `—` (not `0`).
- **Footer row:** `Network total` per day and for the week.

Per-slot detail stays available in the per-branch tabs.

## UI layout

### Hub card (existing `/manpower-schedule` page)

Add as the 4th card:

- Title: `Manpower Dashboard`
- Icon: `📊`
- Accent colour: `hover:border-purple-500`, icon box `bg-purple-100 text-purple-600`
- Target: `/manpower-schedule/dashboard`
- Always visible (not gated on `hasHistory`)

### Dashboard page header

Same pattern as `plan-new-week`:

```
[☰] [👥 HRMS]  │  Manpower Dashboard — {branch or "All Branches"}  │  {dateRangePill}
```

Below the header, a sticky control area:

- **Week pills row** (primary filter): `[ Last Week ] [ This Week ] [ Next Week ]`. `This Week` selected by default. Each pill shows its Mon–Sun range in a small second line.
- **Branch tabs row** (admin only): `[ All Branches ] [ Ampang ] [ Bandar Seri Putra ] [ Klang ] [ … ]`. "All Branches" is the default. BMs never see this row.

### Per-branch view (BM always, admin when a specific branch is selected)

- Day tabs identical in style to Plan New Week, filtered to `getWorkingDaysForBranch(branch)`. First working day for the branch is the default active tab.
- Single table for the selected day:

  | Column | Content |
  |---|---|
  | Time Slot | slot string from `getTimeSlotsForDay(day, branch)` |
  | Manager on Duty | name from `selections[${day}-${slot}-MANAGER]`, styled with `getStaffColorByIndex` chip. Blank when no manager set or `isManagerOnDutySlot` is false. |
  | Coaches | chip list of names from `coach1`..`coach5`, in column order, each coloured via `getStaffColorByIndex`. Empty cells omitted. |
  | Classes | count for that row (0 if none) |

- Opening / closing rows render as a single span cell styled like Plan New Week: `ALL STAFF — EXECUTIVE (OPENING)` / `(CLOSING)`. No `Classes` number.
- Bottom of table: `Day total: X classes`.
- Bottom of page: `Week total: Y classes`.

### All Branches view (admin only, "All Branches" tab active)

- No day tabs.
- Status banner at top:
  - Green: `✅ All {N} branches planned for this week` (when every branch has a planned schedule for the selected week)
  - Yellow: `⚠️ {X} of {N} branches planned — {N-X} outstanding`
  - Red: `🔴 No branches have planned this week yet`
- The per-day × per-branch matrix as described in "All Branches aggregation".
- Unplanned branch rows render greyed; the "Week total" cell shows a `Not planned` pill instead of a number. Clicking the row switches to that branch's tab (same week stays selected).

### Colour and chrome

Reuse existing tokens: page `bg-slate-50`, header `bg-[#2D3F50]`, card `rounded-2xl`, re-use `Sidebar`. No new design tokens.

## Empty states and "planned" detection

### `isWeekPlanned` predicate

```
isWeekPlanned(schedule) =
  schedule exists
  AND schedule.selections has at least one key matching ^.*-coach[1-5]$
      whose value is a non-empty string and not "None"
```

Drafts live only in `localStorage` on the BM's own browser, so a row in the `ManpowerSchedule` table implies submission (`status` is always `"Finalized"` on POST). The coach-cell guard catches the edge case where a BM submitted an empty grid.

### BM empty state (own branch, no schedule for selected week)

Centred card in the main content area:

- **Next week** (the primary nudge case):
  - Heading: `📝 Not planned yet`
  - Body: `Next week's manpower hasn't been planned. BMs should plan 2 weeks ahead.`
  - CTA: `Plan Next Week Now →` → `/manpower-schedule/plan-new-week?start={monday}&end={sunday}`. `plan-new-week/page.tsx` reads these params from `useSearchParams`, auto-confirms the week, and auto-confirms the branch for BMs — CTA lands directly on the planning grid.
  - Footer text: `{Mon date} – {Sun date} (Mon – Sun)`
- **This week**:
  - Heading: `📝 Not planned yet`
  - Body: `This week wasn't planned. Plan it now to track attendance.`
  - CTA: same as above, with current week dates.
- **Last week**:
  - Heading: `📭 No data recorded`
  - Body: `No data was recorded for last week.`
  - **No CTA** — planning the past is confusing.

### Admin per-branch empty state (drilled into a branch with no schedule)

Same card, different copy: `{Branch name} hasn't planned this week yet.` No primary CTA.

Optional secondary link: `Contact BM` → `mailto:{bmEmail}` where `bmEmail` is looked up from `BranchStaff` where `branch = ...` and `role` starts with `branch_manager`. If no email found, the link is hidden.

### Admin "All Branches" partial / empty state

Handled in the status banner + per-row greying described in the All Branches view. No standalone empty card.

### Loading and error states

- On initial fetch: render a skeleton shell of the matrix or single-day table (same row count as real data is expected to have) so the layout does not jump.
- On fetch error: render an inline banner `Couldn't load schedules. [Retry]`. Page chrome (sidebar, header, pills) stays functional.

## Role scoping

### Auto-detect on page load

```
const userRole = session?.user?.role
const userBranch = session?.user?.branchName

if (isBranchManager(userRole) && userBranch) {
  // Lock to userBranch. Hide branch tabs. Skip "All Branches".
  // "Plan Next Week Now →" CTA shown in empty states for this/next week.
} else {
  // Admin, Super-admin, HOD, Executive, or any other authenticated role:
  // Show branch tabs. Default tab = "All Branches".
  // No "Plan Next Week Now →" CTAs in empty states — they can't act on them.
  // "Contact BM" mailto link still shown where applicable.
}
```

Source of truth: `lib/roles.ts` (`isBranchManager`, `isAdmin`, `isSuperAdmin`). Never string-compare `session.user.role` directly.

### Server-side enforcement

None added by this spec — the existing `requireSession` on `GET /api/schedules` is sufficient. The endpoint returns all schedules; client-side filter enforces BM scoping. This is acceptable because:

1. Schedule rows are not sensitive data (branch/day/name assignments visible to all authenticated staff).
2. Adding `?branch=` server filtering is trivial later if business requires it; deferring avoids scope creep here.

Future work note: if this changes, add `branch` query param to `GET /api/schedules` and enforce BM scoping in [app/api/schedules/route.ts](app/api/schedules/route.ts).

## Week filter semantics

- Week boundary: Monday 00:00 (`weekStartsOn: 1`), matching `WeekSelector`.
- Computed **client-side** from `new Date()` in the browser's local time zone. BMs in Asia/Kuala_Lumpur get Malaysia-aligned weeks; this also matches how `WeekSelector` already writes `startDate` values.
- "This week" = Mon of current week through Sun of current week.
- "Last week" = one week earlier; "Next week" = one week later.
- Pills display both the label and the date range (e.g. `This Week` on line 1, `Apr 20 – Apr 26` on line 2).
- When the filter changes, the active day tab resets to the first working day for the selected branch if the previously-active day is not a working day for that branch.

## Testing

### Unit (Vitest, `lib/__tests__/manpower-dashboard.test.ts`)

Target ~15 tests across:

1. `countClassesForSlot(selections, day, slot, branch)`:
   - 0 when all coach cells empty / "None" / missing
   - Counts only `coach1`..`coach5` with non-empty, non-"None" values
   - Ignores `exec1`..`exec5` and `MANAGER` even when populated
   - 0 for opening/closing slots regardless of selections content
2. `isWeekPlanned(schedule)`:
   - `null` / `undefined` → false
   - Schedule with only exec/manager cells filled → false
   - Schedule with one coach cell filled → true
3. `getWeekRanges(today)`:
   - Sunday → Monday boundary (last week still includes the expected range)
   - Across month boundary (e.g. `2026-03-30` → next week is April)
   - Across year boundary (e.g. `2026-12-30` → next week is Jan 2027)

### Manual verification checklist

Committed as part of this spec at `docs/superpowers/specs/2026-04-24-manpower-dashboard-verification.md` (created in the implementation phase). Walkthrough:

- [ ] Log in as admin → dashboard shows "All Branches" + per-branch tabs
- [ ] Log in as BM (e.g. Ampang) → dashboard locked to Ampang, no branch tabs row
- [ ] "This Week" pill active by default; date range under pill matches actual Mon–Sun
- [ ] Branch with schedule: hand-count coach cells for one slot in Plan New Week; dashboard count matches
- [ ] Branch with no schedule: empty-state card appears with appropriate copy per filter (next / this / last)
- [ ] BM clicks "Plan Next Week Now →" → lands on Plan New Week with week pre-selected, no "Select Week" step
- [ ] Admin "All Branches" banner says correct "X of 20 branches planned"
- [ ] Admin clicks a branch row in the matrix → switches to that branch's tab, same week still selected
- [ ] Last Week filter → no CTA button shown even for BM with unplanned last week
- [ ] Year-boundary check: set system clock to 2026-12-30 → Next Week pill shows a Jan 2027 range
- [ ] Opening/closing rows visually distinct in per-day table; not counted in totals

### Out of scope

- Playwright E2E (no existing E2E culture in the project; a checklist is more honest)
- Visual regression
- Load/perf tests

## File manifest

**Create:**
- `app/manpower-schedule/dashboard/page.tsx`
- `app/components/ManpowerDashboard.tsx`
- `lib/manpowerDashboard.ts`
- `lib/__tests__/manpower-dashboard.test.ts`
- `docs/superpowers/specs/2026-04-24-manpower-dashboard-verification.md`

**Modify:**
- `app/manpower-schedule/page.tsx` (add 4th card, adjust grid breakpoint logic)

**Do not modify:**
- `app/api/schedules/route.ts` (reused as-is)
- `app/manpower-schedule/plan-new-week/page.tsx` (reused as-is; CTA depends only on its existing `start`/`end` query-param handling)
- `lib/manpowerUtils.ts` (imported as-is)
- Prisma schema (no DB changes)

## Future work (explicitly deferred)

1. Soft nudge in Plan New Week ("✅ This week planned. Next week still needs planning →") — consider after 1–2 weeks of dashboard use.
2. Hard 2-weeks-ahead rule — only if visibility + soft nudge fail to change behaviour.
3. Server-side `?branch=` filter on `GET /api/schedules` if BM scoping becomes a compliance requirement.
4. Notification backend for "Contact BM" beyond `mailto:`.
5. Richer analytics (month view, coach utilisation, compare-to-last-period).

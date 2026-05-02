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

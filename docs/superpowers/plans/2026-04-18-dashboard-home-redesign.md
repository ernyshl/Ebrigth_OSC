# Dashboard Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `/home` — replace the blue-gradient header and mixed-signal card grid with a minimalist white UI using Ebright red (`#ED1C24`) as the single accent.

**Architecture:** Visual-only refactor of 3 existing components. No new files, no new routes, no logic or data changes. Emoji icons are replaced with `lucide-react` components. Cards keep their uniform 3-column grid; differentiation comes from color/opacity/accent rather than layout.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, `lucide-react` v0.577 (already installed).

**Spec:** `docs/superpowers/specs/2026-04-18-dashboard-home-redesign-design.md`

**Note on testing:** This project has no test runner configured (no `test` script in `package.json`). This plan uses `npm run lint` + `npm run build` + manual visual verification in `npm run dev` as the verification loop. Automated structural tests are not added — writing a test runner from scratch for a pure visual change is out of proportion to the work.

---

## File Structure

| File | Responsibility | Change type |
|---|---|---|
| `app/home/page.tsx` | Page shell: header wrapper, sidebar + main layout | Modify — replace header JSX, fix `calc` height |
| `app/components/DashboardHome.tsx` | Welcome block + dashboard cards | Modify — full rewrite of render logic; replace emoji icon field with Lucide component reference |
| `app/components/UserHeader.tsx` | User avatar button + dropdown | Modify — surgical color/size edits to work on white header |

No new files. No deletions.

---

## Task 1: Restyle `UserHeader` for white header

**Why first:** Smallest, most isolated change. `UserHeader` renders inside the page header; once it's adjusted for a white background, the page header rewrite in Task 3 will look correct immediately.

**Files:**
- Modify: `app/components/UserHeader.tsx`

- [ ] **Step 1: Read the current file to confirm the lines to change**

Run: inspect `app/components/UserHeader.tsx` — specifically the button at line ~41 and the avatar at line ~45.

Expected: the button uses `hover:bg-white/20`, the name paragraph uses `text-white`, the avatar uses `bg-red-500` with `w-10 h-10`.

- [ ] **Step 2: Change the trigger button to render on white**

In `app/components/UserHeader.tsx`, replace the `<button>` opening tag (currently around line 41–44):

```tsx
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
```

Changes vs current:
- `gap-3 px-4 py-2` → `gap-2 px-2 py-1.5` (tighter to match 62px header)
- `hover:bg-white/20` → `hover:bg-gray-100`

- [ ] **Step 3: Change the avatar circle to compact Ebright red**

Replace the avatar `<div>` (currently line ~45):

```tsx
        <div className="w-7 h-7 bg-[#ED1C24] rounded-full flex items-center justify-center text-white font-bold text-xs">
          {userName.split(" ").map((n) => n[0]).join("")}
        </div>
```

Changes vs current:
- `w-10 h-10` → `w-7 h-7` (40px → 28px)
- `bg-red-500` → `bg-[#ED1C24]`
- `text-lg` → `text-xs` (scales initials to new size)

- [ ] **Step 4: Change the user-name label to dark text**

Replace the name label `<div>` (currently line ~48):

```tsx
        <div className="text-left hidden sm:block">
          <p className="text-sm font-semibold text-gray-900">{userName}</p>
        </div>
```

Change: `text-white` → `text-gray-900`.

- [ ] **Step 5: Verify — lint + dev server spot check**

Run: `npm run lint`
Expected: PASS (no new errors in `UserHeader.tsx`).

Run: `npm run dev` and open http://localhost:3000/home.
Expected: The trigger still renders (even though the surrounding header is still blue). The avatar is now smaller and brand-red; initials in white are still legible. Text clashes with the blue header — that's fine, Task 3 fixes the header background.

- [ ] **Step 6: Commit**

```bash
git add app/components/UserHeader.tsx
git commit -m "refactor(home): restyle UserHeader for white-surface header

Prepares UserHeader to sit on the upcoming white dashboard header.
Tightens paddings, shrinks avatar to 28px, switches avatar and text
colors to brand red + gray-900."
```

---

## Task 2: Rewrite `DashboardHome` — welcome block, Lucide icons, new card states

**Files:**
- Modify: `app/components/DashboardHome.tsx`

- [ ] **Step 1: Update the `DashboardCard` type and data to reference Lucide components**

Replace the top of `app/components/DashboardHome.tsx` (imports + type + `dashboards` array) with:

```tsx
"use client";

import Link from "next/link";
import {
  BookOpen,
  BarChart3,
  Users,
  Mail,
  MessageSquare,
  Package,
  GraduationCap,
  Lock,
  ArrowRight,
  LucideIcon,
} from "lucide-react";

interface DashboardCard {
  id: string;
  title: string;
  Icon: LucideIcon;
  items: { name: string; href: string }[];
}

const dashboards: DashboardCard[] = [
  {
    id: "library",
    title: "Library",
    Icon: BookOpen,
    items: [
      { name: "Documents", href: "#" },
      { name: "Resources", href: "#" },
    ],
  },
  {
    id: "internal-dashboard",
    title: "Internal Dashboard",
    Icon: BarChart3,
    items: [
      { name: "Analytics", href: "#" },
      { name: "Reports", href: "#" },
    ],
  },
  {
    id: "hrms",
    title: "HRMS",
    Icon: Users,
    items: [
      { name: "Employee Dashboard", href: "/dashboard-employee-management" },
      { name: "Manpower Planning", href: "/manpower-schedule" },
      { name: "Attendance", href: "/attendance" },
      { name: "Claims", href: "/claims" },
      { name: "Manpower Cost Report", href: "/manpower-cost-report" },
    ],
  },
  {
    id: "crm",
    title: "CRM",
    Icon: Mail,
    items: [
      { name: "Content Manager", href: "#" },
      { name: "Media", href: "#" },
    ],
  },
  {
    id: "sms",
    title: "SMS",
    Icon: MessageSquare,
    items: [
      { name: "Messages", href: "#" },
      { name: "Templates", href: "#" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    Icon: Package,
    items: [
      { name: "Stock Management", href: "#" },
      { name: "Warehouse", href: "#" },
    ],
  },
  {
    id: "academy",
    title: "Academy",
    Icon: GraduationCap,
    items: [
      { name: "Event Management", href: "/academy" },
      { name: "Courses", href: "#" },
    ],
  },
];
```

Notes vs the current file:
- `icon: string` (emoji) → `Icon: LucideIcon` (component reference)
- The per-item `icon: string` (emoji) is dropped from the `items` type since we no longer render per-item emojis; `name` and `href` are preserved so the data stays compatible if anything else reads these.
- `color: string` is dropped — colors now come from active/locked state, not per-module.

- [ ] **Step 2: Write the new `DashboardHome` component body (welcome block + grid)**

Replace the `DashboardHome` function in the same file with:

```tsx
function getGreeting(): string {
  if (typeof window === "undefined") return "Welcome";
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getDisplayName(email?: string): string {
  if (!email) return "there";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default function DashboardHome({ userRole, userEmail }: { userRole?: string; userEmail?: string }) {
  const isBranchManager =
    userRole === "BRANCH_MANAGER" || (userEmail?.toLowerCase().includes("ebright") ?? false);
  const accessibleCount = isBranchManager ? 1 : dashboards.length;
  const totalCount = dashboards.length;
  const displayName = getDisplayName(userEmail);
  const greeting = getGreeting();

  return (
    <div className="min-h-full bg-[#fafafa]">
      <section className="px-6 pt-12 pb-6 text-center">
        <div className="text-[10px] tracking-[2px] text-[#ED1C24] font-bold uppercase mb-2">
          Welcome Back
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1.5">
          {greeting}, {displayName}
        </h1>
        <p className="text-sm text-gray-500">
          {accessibleCount} of {totalCount} module{totalCount !== 1 ? "s" : ""} available
          {accessibleCount < totalCount && (
            <>
              {" · "}
              <button
                type="button"
                className="text-[#ED1C24] font-semibold hover:underline cursor-pointer"
              >
                Request access →
              </button>
            </>
          )}
        </p>
      </section>

      <main className="max-w-[880px] mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {dashboards.map((dashboard) => {
            const isLocked = isBranchManager && dashboard.id !== "hrms";
            const targetHref =
              dashboard.id === "academy"
                ? "/academy"
                : dashboard.id === "sms"
                ? "/sms"
                : `/dashboards/${dashboard.id}`;

            if (isLocked) {
              return (
                <div
                  key={dashboard.id}
                  aria-disabled="true"
                  className="relative bg-white border border-gray-200 rounded-[10px] p-[18px] opacity-[0.65] hover:opacity-90 hover:shadow-sm transition-all duration-200 cursor-not-allowed"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mb-3.5">
                    <dashboard.Icon className="w-[18px] h-[18px] text-gray-400" strokeWidth={2} />
                  </div>
                  <div className="font-bold text-gray-900 text-sm tracking-tight">
                    {dashboard.title}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {dashboard.items.length} tool{dashboard.items.length !== 1 ? "s" : ""}
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-[3px] bg-gray-100 px-[7px] py-[3px] rounded-full">
                    <Lock className="w-[9px] h-[9px] text-gray-400" strokeWidth={2.5} />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.5px] text-gray-400">
                      Locked
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={dashboard.id}
                href={targetHref}
                className="group relative bg-white border border-gray-200 border-l-[3px] border-l-[#ED1C24] rounded-[10px] p-[18px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ED1C24] hover:shadow-[0_10px_24px_rgba(237,28,36,0.12)]"
              >
                <div className="w-9 h-9 rounded-lg bg-[#FEF2F2] flex items-center justify-center mb-3.5">
                  <dashboard.Icon className="w-[18px] h-[18px] text-[#ED1C24]" strokeWidth={2} />
                </div>
                <div className="font-bold text-gray-900 text-sm tracking-tight">
                  {dashboard.title}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {dashboard.items.length} tool{dashboard.items.length !== 1 ? "s" : ""}
                </div>
                <ArrowRight
                  className="absolute top-3.5 right-3.5 w-3.5 h-3.5 text-[#ED1C24] transition-transform duration-200 group-hover:translate-x-1"
                  strokeWidth={2.5}
                />
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
```

Key behaviors baked in:
- `getGreeting()` guards `window` for SSR safety (component is `"use client"` but renders on first paint)
- Time-of-day greeting: morning (<12) / afternoon (<18) / evening
- `getDisplayName` derives a capitalized name from the email local-part (fallback "there") — if a real `userName` is wired through later this can be swapped
- Active card: red left-stripe, red icon tint, red arrow, hover lift with red shadow, arrow slides right on hover via `group-hover`
- Locked card: same size, opacity 0.65 baseline, quiet hover (no lift, no red), "Locked" pill top-right
- No emojis anywhere

- [ ] **Step 3: Verify — lint + type check via build**

Run: `npm run lint`
Expected: PASS.

Run: `npm run build`
Expected: PASS. TypeScript compiles; `LucideIcon` type resolves; JSX renders without unused-import errors.

If build reports "Module not found: lucide-react" — check `package.json`; `lucide-react ^0.577.0` is already a dependency so this should not happen. If it does, run `npm install` once.

- [ ] **Step 4: Visual verification in dev server**

Run: `npm run dev` and open http://localhost:3000/home.

Check (page still wraps in the old blue header — Task 3 fixes that):
- Big "Welcome" red text is gone
- Small red "WELCOME BACK" eyebrow appears
- Heading reads "Good [morning|afternoon|evening], [Name]"
- Sub-line shows "N of 7 modules available" plus "Request access →" in red (only when some are locked)
- Cards are white, same size, 3 columns on desktop
- Active card has a red left stripe + red icon + red arrow; hovering lifts it and the arrow slides right
- Locked cards show the gray "🔒 LOCKED" pill top-right and do not respond to hover with a lift

- [ ] **Step 5: Commit**

```bash
git add app/components/DashboardHome.tsx
git commit -m "feat(home): redesign DashboardHome with minimalist card grid

Replaces emoji-based cards with Lucide icons and a uniform white grid.
Active card uses red left-stripe + red accent icon; locked cards share
the same size but carry a Locked pill and quiet hover. Welcome block
now greets the user by time-of-day with a red eyebrow label."
```

---

## Task 3: Rewrite the page header in `app/home/page.tsx`

**Files:**
- Modify: `app/home/page.tsx`

- [ ] **Step 1: Replace the header JSX**

In `app/home/page.tsx`, replace the `<header>…</header>` block (currently lines ~33–46) with:

```tsx
      <header className="bg-white border-b border-gray-200">
        <div className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setSidebarOpen(p => !p)}
              aria-label="Toggle sidebar"
              className="w-7 h-7 flex flex-col justify-center gap-[4px] cursor-pointer"
            >
              <span className="h-[2px] bg-gray-900 rounded-sm"></span>
              <span className="h-[2px] bg-gray-900 rounded-sm"></span>
              <span className="h-[2px] bg-gray-900 rounded-sm"></span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] bg-[#ED1C24] rounded-md flex items-center justify-center text-white font-extrabold text-[13px]">
                E
              </div>
              <div>
                <div className="font-bold text-gray-900 text-[15px] tracking-tight leading-none">
                  Ebright Portal
                </div>
                <div className="text-gray-500 text-[11px] mt-0.5 leading-none">
                  Dashboard
                </div>
              </div>
            </div>
          </div>

          <UserHeader
            userName={branchName}
            userEmail={userEmail}
          />
        </div>
      </header>
```

Notes:
- Header is now ~62px tall (`py-4`) vs the old ~100px.
- The sidebar-toggle hamburger is now part of the header (before, the toggle lived only in `Sidebar`). If `Sidebar` already has its own internal toggle, leaving both is fine — both can call the same `setSidebarOpen`. If this causes duplicate toggles in the sidebar's first collapsed state, remove the internal one in a follow-up — out of scope here.

- [ ] **Step 2: Fix the height calc for the main content area**

In the same file, update the `<div className="flex h-[calc(100vh-100px)]">` (currently line ~48) to match the new ~62px header:

```tsx
      <div className="flex min-h-[calc(100vh-62px)]">
```

Changes:
- `h-[calc(100vh-100px)]` → `min-h-[calc(100vh-62px)]`
- Using `min-h-` instead of `h-` lets the main content grow beyond viewport if needed (current fixed height was causing hidden overflow on tall content).

- [ ] **Step 3: Simplify the loading state to match the new palette**

Replace the existing loading state (currently line ~23):

```tsx
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] text-gray-500 text-sm">
        Loading Dashboard…
      </div>
    );
```

Changes:
- `bg-gray-50` → `bg-[#fafafa]` (exact token from spec)
- `text-blue-600 font-bold text-xl` → `text-gray-500 text-sm` (quiet, fits minimalist tone; no blue)

- [ ] **Step 4: Verify — lint + build**

Run: `npm run lint && npm run build`
Expected: Both PASS with no new warnings or errors in `app/home/page.tsx`.

- [ ] **Step 5: Visual verification in dev server**

Run: `npm run dev` and open http://localhost:3000/home.

Full-page checks:
- Header is white with a thin bottom border — no blue gradient anywhere
- Left side: hamburger, then red "E" tile, then "Ebright Portal" / "Dashboard"
- Right side: `UserHeader` — red 28px avatar, dark text, hover shows `bg-gray-100`
- Welcome block and cards render as in Task 2
- Sidebar still slides/toggles correctly
- Main content area fills the viewport without hidden overflow

Edge cases to spot-check:
- Sign in as an account whose email contains "ebright" → should see 1 unlocked (HRMS) and 6 locked cards with the "Request access →" link visible
- Sign in as another account (non-branch-manager) → all 7 cards unlocked, no "Request access" link shown
- Resize to narrow viewport — grid collapses to 1 column (`grid-cols-1`)

- [ ] **Step 6: Commit**

```bash
git add app/home/page.tsx
git commit -m "feat(home): replace gradient header with minimalist white header

Swaps the blue gradient header for a white 62px header featuring the
Ebright red 'E' brand mark, wordmark, and a sidebar toggle. Fixes the
viewport height calc to match the new shorter header and quiets the
loading state."
```

---

## Final Verification

- [ ] **Step 1: Full build + lint pass**

Run: `npm run lint && npm run build`
Expected: All green.

- [ ] **Step 2: End-to-end visual walk-through**

Run: `npm run dev`, sign in, open `/home`.

Confirm against the approved interactive prototype (`.superpowers/brainstorm/77-1776489881/content/full-mockup-interactive.html`):
- Header matches (white, red E, compact)
- Welcome block matches (red eyebrow, black heading with greeting, count + request link)
- Grid cards match (uniform size, red stripe + arrow on active, muted Locked pill on locked)
- Hover behaviors match (lift + red shadow + arrow slide on active; opacity + small shadow on locked)

- [ ] **Step 3: (optional) Stop the visual-companion server**

Run: `bash "C:/Users/user/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/scripts/stop-server.sh" "c:/Users/user/Desktop/baltoratora/00 OPTIMISATION DEPARTMENT/VSC/OSC/Ebrigth_OSC/.superpowers/brainstorm/77-1776489881"`

Mockup files persist in `.superpowers/brainstorm/` for reference.

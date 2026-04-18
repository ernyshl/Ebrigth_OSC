# Dashboard Home Redesign — Design Spec

**Date:** 2026-04-18
**Scope:** `/home` page — visual-only redesign of the dashboard landing page
**Out of scope:** Sidebar layout, data/routing changes, access-control logic, dropdown menu contents

## Goal

Replace the current dashboard home UI (red "Welcome" heading, blue gradient header, grayscale-dominated card grid) with a minimalist modern design using Ebright brand red (`#ED1C24`) as the single accent color. Uniform 3-column grid is preserved — only visual treatment changes.

## Design direction

Picked during brainstorming:
- **Visual style:** Minimalist Modern — white surfaces, thin borders, generous whitespace (Stripe/Linear aesthetic)
- **Accent color:** Ebright red `#ED1C24` — used sparingly as the single brand accent
- **Layout:** Uniform 3-column grid (unchanged from current) — all cards same size, restyled
- **Icon system:** Lucide-react line icons (replaces emoji icons)

## Design tokens

| Token | Value | Usage |
|---|---|---|
| `--ebright-red` | `#ED1C24` | Accent: active card border-stripe, icons, links, eyebrow label, brand mark |
| `--ebright-red-soft` | `#FEF2F2` | Tinted tile background behind active-card icon |
| Surface | `#FFFFFF` | Header, cards |
| Page bg | `#FAFAFA` | Main content background |
| Border | `#E5E7EB` | Card borders, header separator |
| Text primary | `#111111` | Headings, card titles |
| Text secondary | `#6B7280` | Subtitles, card meta |
| Text muted (locked) | `#9CA3AF` | Locked card icon, "Locked" pill text |
| Locked tile bg | `#F3F4F6` | Locked card icon tile, "Locked" pill bg |
| Card radius | `10px` | All cards |
| Icon tile radius | `8px` | 36×36 square behind each card icon |
| Card transition | `180ms ease` | transform + box-shadow + border-color |

## Components & changes

### 1. `app/home/page.tsx` — Page header

**Current:** Blue gradient header (`from-blue-600 to-blue-800`), white text, 3xl "Ebright Portal" + "Dashboard Home" subtitle.

**New:** White header with bottom border. Left side: sidebar toggle (hamburger), Ebright red "E" brand mark (26px rounded square, white letter), "Ebright Portal" wordmark in black 15px, "Dashboard" subtitle in gray 11px. Right side: `UserHeader` component (restyled — see §3).

Height: compact (~62px, from `py-6` → `py-4`). No shadow — only a bottom border.

**Follow-up inside `page.tsx`:** the sibling flex container currently uses `h-[calc(100vh-100px)]` assuming a 100px header. With the new ~62px header this should become `h-[calc(100vh-62px)]` (or a more forgiving `min-h-[calc(100vh-62px)]`). Keep the sidebar markup otherwise untouched.

### 2. `app/components/DashboardHome.tsx` — Body

**Welcome block (above grid):**
- Small red uppercase eyebrow: `WELCOME BACK` (10px, letter-spacing 2px, weight 700)
- Heading: `Good afternoon, {userName}` — 30px, weight 700, tight letter-spacing, black. Time-of-day greeting derived client-side from `new Date().getHours()`:
  - 0–11 → "Good morning"
  - 12–17 → "Good afternoon"
  - 18–23 → "Good evening"
- Sub-line: `{accessibleCount} of {totalCount} modules available · `[Request access →]{.red-link}
- "Request access" link color `#ED1C24`, weight 600. For v1 this links to `mailto:` or a no-op — see open question #1.
- Drop the current centered `<h1 class="text-4xl text-red-600">Welcome</h1>` entirely.

**Grid (uniform 3-column, unchanged structure):**
- `grid-cols-1 md:grid-cols-3 gap-3.5` (14px gap), max-w 880px, centered
- Each card: 18px padding, white, `border border-gray-200`, `rounded-[10px]`, shadow-sm
- All cards same size — current aspect-square is dropped; cards size naturally from content (~100px tall)

**Active (unlocked) card:**
- Adds `border-l-[3px] border-l-[#ED1C24]` (overrides left border)
- Icon tile: 36×36 rounded-lg, bg `#FEF2F2`, Lucide icon stroke `#ED1C24` at 18px
- Top-right: red arrow `→` at 14px, weight 600
- Hover: `translate-y-[-2px]`, box-shadow `0 10px 24px rgba(237,28,36,0.12)`, `border-color #ED1C24`, arrow translates right 4px
- Active (mousedown): `translate-y-0`
- Cursor pointer, wrapped in Next `Link` to module href

**Locked card:**
- Same size and layout as active — no shrinking, no grayscale filter
- Base opacity `0.65`
- Icon tile: 36×36 rounded-lg, bg `#F3F4F6`, Lucide icon stroke `#9CA3AF`
- Card title in `#111`, meta in `#9CA3AF`
- Top-right: "Locked" pill — bg `#F3F4F6`, rounded-full, 3×7px padding, lock icon (9px) + text "LOCKED" (9px, uppercase, weight 600, letter-spacing 0.5, color `#9CA3AF`)
- Hover: opacity `0.9`, subtle shadow — no lift, no red
- Click: currently a no-op (`href="#"`, `pointer-events-none`). Keep this behavior. See open question #1.

**Icon map (Lucide):**

| Module | Icon |
|---|---|
| Library | `BookOpen` |
| Internal Dashboard | `BarChart3` |
| HRMS | `Users` |
| CRM | `Mail` (was emoji 📰 — `Mail` better reflects CRM) |
| SMS | `MessageSquare` |
| Inventory | `Package` |
| Academy | `GraduationCap` |

Emoji `icon` field on each `DashboardCard` entry is replaced with a Lucide component reference (or a string key mapped to a component).

### 3. `app/components/UserHeader.tsx` — User chip

**Current:** Styled for blue gradient (white text, white/20 hover). Avatar uses `bg-red-500` (#EF4444).

**Changes:**
- Button hover: `hover:bg-gray-100` (was `hover:bg-white/20`)
- User name text: `text-gray-900` (was `text-white`)
- Avatar: change `bg-red-500` → `bg-[#ED1C24]` (brand red)
- Avatar size: 28px (was 40px) to match compact header
- Dropdown menu contents unchanged (out of scope for visual refresh beyond what's needed for the new header contrast)

### 4. Background

`<div className="min-h-screen bg-gray-50">` wrapper stays. `DashboardHome` inner `bg-gray-50` already matches — no change.

## Interaction details

- All card transitions use `transition-all duration-200 ease-out`
- Active card hover uses the compound effect specified above (lift + red shadow + arrow slide)
- Locked card hover is intentionally quieter (opacity + small shadow) to signal non-interactivity without being dead
- No new keyboard focus styles beyond Tailwind defaults in this pass (out of scope; can be a follow-up accessibility pass)

## Files touched

1. `app/home/page.tsx` — replace header JSX, pass `userName` greeting data
2. `app/components/DashboardHome.tsx` — full rewrite of welcome block + card rendering; switch emoji `icon` field to Lucide components; restructure locked vs active card rendering
3. `app/components/UserHeader.tsx` — surgical changes: hover color, text color, avatar color/size

No new files are created.

## Open questions

1. **"Request access" link destination.** No real request-access flow exists today. Default: render the link as an inert `<button>` with no `href` (visual element only, no action) until the destination is decided. If a mailto target or internal page is preferred, swap it in — it's a one-line change.
2. **Time-of-day greeting localization.** Timezone is whatever the browser reports; for Malaysia (MYT) this is typically correct. If server-rendered greeting is preferred later, that's a separate change.

## Non-goals

- No sidebar redesign
- No change to routing/access-control behavior
- No change to the list of modules or their `items` sub-lists
- No animation library added (pure CSS transitions)
- No dark mode

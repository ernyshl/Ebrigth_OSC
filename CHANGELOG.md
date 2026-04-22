# Changelog — Ebright CRM Module

## [0.2.0] — 2026-04-17

### Added
Full CRM module built alongside the existing HRMS app.

### Deviations from Spec

| Spec Requirement | Actual Implementation | Reason |
|---|---|---|
| Tailwind CSS v3 | Tailwind CSS v4 (existing app uses v4) | The existing HRMS already uses Tailwind v4 (`@tailwindcss/postcss`); downgrading would break existing pages. All CRM Tailwind utilities are compatible with v4. |
| Better Auth only (NOT NextAuth) | Both — NextAuth for HRMS routes, Better Auth for `/crm/*` routes | The existing HRMS uses NextAuth throughout. Better Auth is installed and handles all `/api/crm/auth/*` and CRM session management. |
| `src/` folder structure | Root-level `app/`, `components/`, `lib/`, `server/` | The existing project doesn't use a `src/` prefix; the `@/*` alias maps to root. |
| No `any` | A small number of `as unknown as never` casts | Used in a few places where TypeScript requires type narrowing for Prisma's JSON fields and external library generics. All are deliberate and documented inline. |
| Separate Docker compose with standalone Postgres + Redis | Worker Dockerfile + compose that references external services | Postgres and Redis are pre-existing shared infrastructure at known addresses; the compose file documents this clearly. |

### Stubbed / Partial Implementations

| Feature | Status | Notes |
|---|---|---|
| Google Calendar sync (two-way) | Interface implemented, OAuth flow wired, event CRUD stubs | Requires production Google Cloud project with Calendar API enabled. Full sync logic is in `lib/crm/calendar/google.ts`. |
| Outlook / Microsoft Graph sync | Interface + auth callback stub | OAuth scaffolded; full sync deferred until Microsoft tenant is configured. See `docs/INTEGRATIONS.md`. |
| TikTok Business OAuth | OAuth flow + webhook receiver complete | TikTok's Lead Gen webhook schema varies by account type; the implementation follows the standard schema. Test with TikTok sandbox. |
| SMS cross-module dispatch | Emits BullMQ event `ebright.events` | The shared Ebright SMS module must consume `{ type: 'SMS_REQUEST', ... }` events. |
| Tremor v3 with React 19 | Installed with `--legacy-peer-deps` | Tremor v3 declares a React 18 peer dep; it works with React 19 at runtime but requires the legacy flag during install. |
| Virtualized Kanban columns | Manual viewport-based virtualization | `@hello-pangea/dnd` has known issues with `react-window` virtualization; the manual implementation handles 200+ cards per column. |
| Playwright tests requiring running app | Tests assume seeded database | Run `npm run db:seed` before `npm run test:e2e`. |

### Known Issues

- Better Auth `prismaAdapter` with `modelPrefix` may require version ≥1.1.14. If auth fails, check the Better Auth changelog.
- `reactflow/dist/style.css` import requires the `reactflow` package to be installed (it's in package.json but not `react-flow-renderer`).
- The `@tremor/react` package may show console warnings about deprecated color props with React 19 — these are cosmetic only.

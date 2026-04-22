# Architecture — Ebright CRM Module

## Tenancy Model

```
Tenant (crm_tenant)
  └── Branch (crm_branch) [1..N per tenant]
        └── Users (crm_auth_user via crm_user_branch) [M2M with role]
        └── Pipeline (crm_pipeline) [1..N per branch]
              └── Stage (crm_stage) [ordered, 16 default]
        └── Contact (crm_contact)
              └── Opportunity (crm_opportunity) → Stage
              └── Messages, Notes, Tasks, Calls
        └── Automation (crm_automation)
        └── Integration (crm_integration)
```

Every `crm_*` table carries `tenantId` (enforced in `lib/crm/tenancy.ts`). In development, any Prisma query without `tenantId` throws immediately. In production it throws a safe "Unauthorized" error.

## Data Model Overview

| Model | Purpose |
|---|---|
| `crm_tenant` | Top-level agency account |
| `crm_branch` | Physical or logical branch of the agency |
| `crm_auth_user` | CRM-specific user (separate from HRMS `User`) |
| `crm_user_branch` | M2M: user ↔ branch with per-assignment role |
| `crm_pipeline` | Named pipeline per branch |
| `crm_stage` | Ordered funnel stage within a pipeline |
| `crm_contact` | Lead / parent enquiry |
| `crm_opportunity` | A lead at a specific stage in a pipeline |
| `crm_stage_history` | Immutable audit trail of stage transitions |
| `crm_automation` | Workflow definition (React Flow graph JSON) |
| `crm_automation_run` | Per-execution log of an automation |
| `core_audit_log` | Shared PDPA audit log (not crm_ prefixed) |

## Request Flow

```
Browser → Next.js App Router (app/crm/*)
  → CRM Layout (server component) — reads Better Auth session
  → If no session → redirect /crm/login
  → If session → render CrmShell + page

Page (server component) → queries server/queries/*.ts
  → prisma queries with tenantId always scoped

Client components → TanStack Query hooks → /api/crm/*
  → API route validates session + input (Zod)
  → calls server actions or queries
  → returns JSON
```

## BullMQ Topology

```
Producer (API route / trigger)
  → automationQueue    (crm.automation)
  → messageSenderQueue (crm.message_sender)
  → reminderQueue      (crm.reminder)
  → integrationSyncQueue (crm.integration_sync)
  → digestQueue        (crm.digest)

Workers (server/workers/*.ts — run separately via `npm run worker`)
  ← automationWorker   processes automation graph node-by-node
  ← messageSenderWorker sends WhatsApp / email, updates crm_message status
  ← reminderWorker     scans stuck leads, creates notifications
  ← digestWorker       daily 08:00 KL email digest to BMs
  ← integrationSyncWorker polls Google Sheets, syncs calendar events

Cross-module events → ebright.events queue (consumed by SMS, HRMS modules)
```

## Automation Engine Design

Each automation is stored as a React Flow graph (`crm_automation.graph`):
```json
{
  "nodes": [{ "id": "trigger-1", "type": "trigger", "data": {...} }, ...],
  "edges": [{ "source": "trigger-1", "target": "action-1" }, ...]
}
```

**Execution**:
1. A trigger fires → `enqueueAutomation(jobData)` → BullMQ job
2. `automationWorker` picks up job → finds trigger node → follows edges depth-first
3. For each action node: runs the corresponding handler
4. For `delay` nodes: re-enqueues the job with BullMQ's built-in delay
5. For `ifElse` nodes: evaluates condition → follows the `yes` or `no` edge
6. Every step appended to `crm_automation_run.logs`
7. On completion: status = COMPLETED; on failure after 3 retries: status = FAILED + admin notification

## PDPA Compliance

- Every contact detail page load calls `logAudit({ action: 'READ', entity: 'crm_contact', entityId })`.
- Every mutation (CREATE/UPDATE/DELETE) calls `logAudit`.
- LOGIN/LOGOUT logged via Better Auth hooks.
- `core_audit_log` rows are immutable — only INSERT.
- Admin UI at `/crm/settings/audit-log` shows the full log with export.
- Configurable retention (default 365 days); nightly cleanup cron removes expired rows.

## Security

- AES-256-GCM for all OAuth tokens and WhatsApp credentials at rest (`lib/crm/crypto.ts`).
- API keys stored as SHA-256 hash only; plain key shown once on creation.
- RBAC enforced on every Server Action and API route via `requirePermission`.
- Webhook signatures verified before processing (HMAC-SHA256 for Meta, HMAC-SHA1 for Twilio).
- Session cookies scoped to `.ebright.my` (configured in Better Auth).

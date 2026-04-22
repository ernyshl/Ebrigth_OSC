# Public API Reference

## Authentication

All CRM API endpoints require either a session cookie (browser) or an API key header:

```
Authorization: Bearer ek_your_api_key_here
```

API keys are generated at `/crm/settings/api-keys`. Keys are tenant-scoped and support granular scopes (e.g. `contacts:read`, `contacts:write`).

## Rate Limits

- **Authenticated sessions**: 1,000 req/min per user
- **API keys**: 500 req/min per key
- Headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Contacts

### GET `/api/crm/contacts`
List contacts with pagination, sorting, and filtering.

**Query params**:
| Param | Type | Description |
|---|---|---|
| `search` | string | Search name, phone, or email |
| `branchId` | UUID | Filter by branch |
| `stageId` | UUID | Filter by current stage |
| `leadSourceId` | UUID | Filter by lead source |
| `assignedUserId` | UUID | Filter by assigned BM |
| `tagId` | UUID | Filter by tag |
| `page` | int | Default 1 |
| `pageSize` | int | Default 25, max 100 |
| `sortBy` | string | `createdAt`, `lastName`, `lastStageChangeAt` |
| `sortDir` | `asc`/`desc` | Default `desc` |

**Response**:
```json
{
  "data": [{ "id": "...", "firstName": "Ahmad", "phone": "+60123456789", ... }],
  "total": 320,
  "page": 1,
  "pageSize": 25
}
```

### POST `/api/crm/contacts`
Create a contact.

**Body** (JSON):
```json
{
  "firstName": "Ahmad",
  "lastName": "bin Hassan",
  "phone": "+60123456789",
  "email": "ahmad@example.com",
  "leadSourceId": "uuid",
  "childName1": "Aryan",
  "childAge1": "5 years",
  "preferredTrialDay": "SAT"
}
```

### GET `/api/crm/contacts/:id`
Get a single contact with all relations (opportunities, messages, notes, tasks, calls).

### PATCH `/api/crm/contacts/:id`
Update contact fields (partial update).

### DELETE `/api/crm/contacts/:id`
Soft delete (sets `deletedAt`).

---

## Opportunities

### GET `/api/crm/opportunities`
Get kanban data for a pipeline.

**Query params**: `pipelineId` (required), `branchId`, `search`

### POST `/api/crm/opportunities`
Create an opportunity.

### POST `/api/crm/opportunities/:id/move`
Move opportunity to a new stage.

**Body**:
```json
{ "toStageId": "uuid", "note": "Client confirmed for Saturday" }
```

---

## Messages

### GET `/api/crm/contacts/:id/messages`
List all messages for a contact (EMAIL + WHATSAPP).

### POST `/api/crm/contacts/:id/messages`
Send a message to a contact.

**Body**:
```json
{
  "channel": "WHATSAPP",
  "body": "Hi Ahmad, just checking in!"
}
```

---

## Automations

### GET `/api/crm/automations`
List automations. Query: `branchId`.

### POST `/api/crm/automations`
Create automation.

### PATCH `/api/crm/automations/:id`
Update automation (including graph JSON).

### POST `/api/crm/automations/:id/toggle`
Enable/disable. Body: `{ "enabled": true }`.

---

## Public Endpoints (no auth required)

### POST `/api/forms/:slug/submit`
Submit a website form.

**Body**: JSON with form field IDs as keys.

---

## Webhooks (inbound, no auth — signature-verified)

| Endpoint | Provider |
|---|---|
| `POST /api/webhooks/meta/:branchId` | Meta Lead Ads |
| `POST /api/webhooks/tiktok/:branchId` | TikTok Lead Gen |
| `POST /api/webhooks/wix/:branchId` | Wix Forms |
| `POST /api/webhooks/whatsapp/meta/:branchId` | Meta WhatsApp Cloud |
| `POST /api/webhooks/whatsapp/twilio/:branchId` | Twilio WhatsApp |

All webhooks verify provider-specific signatures before processing.

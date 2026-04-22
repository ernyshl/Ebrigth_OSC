# Automation Engine Reference

## Triggers

| Trigger | Config | Fires When |
|---|---|---|
| `NEW_LEAD` | _(none)_ | A new `crm_contact` is created |
| `STAGE_CHANGED` | `{ fromStageId?, toStageId? }` | Opportunity moves to a new stage (filter by from/to) |
| `TAG_ADDED` | `{ tagId }` | A specific tag is added to a contact |
| `TAG_REMOVED` | `{ tagId }` | A specific tag is removed |
| `TIME_IN_STAGE` | `{ stageId, hours }` | Opportunity stuck in stage for X hours |
| `SCHEDULED` | `{ cron: '0 9 * * 1' }` | BullMQ repeatable cron expression |
| `FORM_SUBMITTED` | `{ formId? }` | A website form is submitted |
| `INCOMING_MESSAGE` | `{ channel?: 'WHATSAPP'/'EMAIL' }` | An inbound message arrives |
| `CUSTOM_FIELD_CHANGED` | `{ field, value? }` | A contact custom field changes |
| `APPOINTMENT_BOOKED` | _(none)_ | A `crm_appointment` is created |
| `CONTACT_REPLIED` | _(none)_ | Contact sends any message after the automation started |
| `NO_REPLY_AFTER` | `{ hours }` | No reply received within X hours of last outbound message |

---

## Action Nodes

| Action | Data Fields | Description |
|---|---|---|
| `sendWhatsApp` | `body: string` | Send WhatsApp via branch's configured provider. Body supports merge tags. |
| `sendEmail` | `subject, body` | Send email via Resend. Body is HTML. Supports merge tags. |
| `sendSms` | `body` | Emit `ebright.events` BullMQ event for the SMS module. |
| `addTag` | `tagId` | Add tag to contact (idempotent). |
| `removeTag` | `tagId` | Remove tag from contact. |
| `moveStage` | `stageId` | Move opportunity to specified stage, writes stage history. |
| `assignUser` | `userId` | Set contact.assignedUserId. |
| `createTask` | `title, dueOffsetHours?` | Create a task; due = now + offset hours. |
| `delay` | `amount, unit: 'minutes'/'hours'/'days'` | Re-enqueue with BullMQ delay. Does not block the worker thread. |
| `ifElse` | `field, operator, value` | Evaluate condition; follow `yes` or `no` output edge. |
| `sendNotification` | `userId?, title, body` | Create `crm_notification` for a specific user (defaults to assigned BM). |
| `updateField` | `field, value` | Update a contact's custom field. |
| `sendWebhook` | `url, method?` | HTTP POST to external URL with contact data as JSON payload. |

---

## Merge Tags Reference

Use these in message body text (WhatsApp, Email, SMS):

### Contact
| Tag | Resolves to |
|---|---|
| `{{contact.first_name}}` | Contact's first name |
| `{{contact.last_name}}` | Contact's last name |
| `{{contact.email}}` | Contact email |
| `{{contact.phone}}` | E.164 phone number |
| `{{contact.child_name_1}}` … `{{contact.child_name_4}}` | Child names |
| `{{contact.child_age_1}}` … `{{contact.child_age_4}}` | Child ages |
| `{{contact.preferred_trial_day}}` | e.g. "SAT" |
| `{{contact.enrolled_package}}` | Enrolled package name |

### Branch
| Tag | Resolves to |
|---|---|
| `{{branch.name}}` | Branch name |
| `{{branch.phone}}` | Branch phone |
| `{{branch.email}}` | Branch email |
| `{{branch.address}}` | Branch address |

### Opportunity
| Tag | Resolves to |
|---|---|
| `{{opportunity.value}}` | Formatted as RM (e.g. "RM5,200.00") |

### Custom Values
| Tag | Resolves to |
|---|---|
| `{{custom_values.KEY}}` | Value of custom value with that key |

**Unknown tags** are left unchanged: `{{unknown.tag}}` → `{{unknown.tag}}`

---

## Example: Welcome Automation

```
[Trigger: NEW_LEAD]
    ↓
[Action: sendWhatsApp]
  body: "Hi {{contact.first_name}}! 👋 We'd love to book a trial class for 
         {{contact.child_name_1}} at Ebright OSC. When works for you?"
    ↓
[Delay: 1 day]
    ↓
[Action: sendEmail]
  subject: "Following up on your enquiry"
  body: "Hi {{contact.first_name}}, we sent you a WhatsApp earlier..."
    ↓
[Delay: 2 days]
    ↓
[If/Else: contact.tag includes 'Follow-Up Needed']
  YES ↓                    NO ↓
[sendWhatsApp]         [createTask]
  "Final follow-up"    title: "Mark as cold lead"
```

---

## Execution Guarantees

- **At-least-once delivery**: BullMQ retries failed jobs 3× with exponential backoff.
- **Delayed jobs**: BullMQ's built-in delay mechanism (no polling); the worker sleeps efficiently.
- **Idempotency**: Tag actions are idempotent (upsert). Stage moves check if already in target stage.
- **Failure logging**: Every step (success or failure) is appended to `crm_automation_run.logs` as JSON.
- **Admin notifications**: On final failure (after all retries), a `crm_notification` is created for Super/Agency Admins.

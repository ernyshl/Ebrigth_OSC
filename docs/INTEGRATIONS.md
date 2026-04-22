# Integrations Setup Guide

## 1. Resend (Email)

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain (e.g. `ebright.my`)
3. Create an API key with `Full Access`
4. Set `CRM_RESEND_API_KEY` in `.env`
5. Set `CRM_FROM_EMAIL="Ebright OSC <noreply@ebright.my>"`
6. In `/crm/settings/branches` → edit each branch → set "From Email" and "From Name"
7. The "Domain Verified" badge in branch settings will show green once Resend confirms the domain

**DKIM/SPF**: Resend provides DNS records — add them to your domain registrar. Verification may take up to 48h.

---

## 2. Meta (Facebook & Instagram Lead Ads)

### Create a Meta App
1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → Business
2. Add products: **Facebook Login**, **Webhooks**, **Lead Ads**
3. Note `App ID` and `App Secret` → set `META_APP_ID`, `META_APP_SECRET`
4. Generate a random `CRM_META_VERIFY_TOKEN` (any string)

### Configure Webhook
1. In the Meta App dashboard → Webhooks → Subscribe to `leadgen` events
2. Callback URL: `https://crm.ebright.my/api/webhooks/meta/{branchId}`
3. Verify Token: same as `CRM_META_VERIFY_TOKEN`

### Connect in CRM
1. Go to `/crm/integrations` → Meta Business → Connect
2. Complete the OAuth flow (authorize the app to access your Pages)
3. Select which Facebook Page and Lead Ad form to subscribe to
4. Test with Meta's Lead Ads Testing Tool

---

## 3. TikTok Business (Lead Generation)

### Create a TikTok App
1. Apply for access at [business.tiktok.com/portal/apps](https://business.tiktok.com/portal/apps)
2. Create a new app with **Lead Generation** permission
3. Set redirect URI: `https://crm.ebright.my/api/crm/integrations/tiktok/callback`
4. Note `App ID` and `App Secret` → set `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`

### Connect in CRM
1. `/crm/integrations` → TikTok Business → Connect
2. Authorize and select your TikTok Business account
3. Webhook will be auto-subscribed for new lead events

---

## 4. Wix

1. In your Wix site → Settings → Velo API → Webhooks
2. Add webhook URL: `https://crm.ebright.my/api/webhooks/wix/{branchId}`
3. Select event: "Form Submission" (or use Wix Automations to trigger on form submit)
4. The CRM will map: Name → firstName/lastName, Email → email, Phone → phone (normalized)

---

## 5. Google (Forms/Sheets + Calendar)

### Create Google Cloud Project
1. [console.cloud.google.com](https://console.cloud.google.com) → New Project
2. Enable APIs: **Google Sheets API**, **Google Drive API**, **Google Calendar API**
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `https://crm.ebright.my/api/crm/integrations/google/callback`
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### Google Forms / Sheets Sync
1. Create a Google Sheet where form responses are collected (Google Forms → Responses → Link to Sheets)
2. `/crm/integrations` → Google Forms → Connect → Select the Sheet
3. Map Sheet columns to CRM contact fields (UI in integration settings)
4. New rows since `lastSyncAt` are synced every 15 minutes via `integrationSyncWorker`

### Google Calendar Sync
1. `/crm/integrations` → Google Calendar → Connect
2. Select which calendar to sync with
3. CRM appointments → Google events (two-way: local changes push to Google, Google changes pull to CRM via push notifications)

---

## 6. Outlook / Microsoft (Calendar)

1. Register app in [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. Add redirect URI: `https://crm.ebright.my/api/crm/integrations/outlook/callback`
3. Grant permissions: `Calendars.ReadWrite`, `offline_access`
4. Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
5. **Note**: Full two-way sync is implemented as a stub — complete `lib/crm/calendar/outlook.ts` with the Microsoft Graph API calls following the pattern in `lib/crm/calendar/google.ts`.

---

## 7. WhatsApp — Meta Cloud API

1. In Meta App dashboard → Add product: WhatsApp
2. Set up a Business phone number (must be verified)
3. Note `Phone Number ID` and generate a permanent access token
4. Webhook for inbound messages: `https://crm.ebright.my/api/webhooks/whatsapp/meta/{branchId}`
5. In CRM: `/crm/settings/branches` → select branch → WhatsApp → choose "Meta Cloud API" → enter credentials

---

## 8. WhatsApp — Twilio

1. Sign up at [twilio.com](https://twilio.com) → Activate WhatsApp Sandbox (or apply for production)
2. Note `Account SID` and `Auth Token`
3. In Twilio console → Messaging → WhatsApp → Sandbox Settings (or Production settings)
4. Set webhook: `https://crm.ebright.my/api/webhooks/whatsapp/twilio/{branchId}`
5. In CRM: `/crm/settings/branches` → WhatsApp → choose "Twilio" → enter Account SID + Auth Token + from number

---

## 9. VAPID (Web Push)

Generate VAPID keys once and add to `.env`:
```bash
npx web-push generate-vapid-keys
```

---

## 10. Website Form Embed

1. Go to `/crm/settings/forms` → Create Form
2. Drag fields from the palette to build your enquiry form
3. Save — a public URL is generated: `https://crm.ebright.my/f/{slug}`
4. Copy the embed snippet and paste into your website's HTML:
```html
<iframe src="https://crm.ebright.my/f/your-slug" 
        width="100%" height="600" frameborder="0" loading="lazy">
</iframe>
```
5. Submissions automatically create contacts in the CRM with lead source = "Website"

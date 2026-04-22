/**
 * Resend email service for the CRM module.
 *
 * Provides:
 *  - sendEmail        – low-level send with explicit html/subject
 *  - sendTemplatedEmail – render a merge-tag template then send
 *
 * The default "from" address falls back to:
 *   CRM_FROM_EMAIL env var → "noreply@ebright.my"
 */

import { Resend } from 'resend'
import { renderTemplate } from './template'
import type { TemplateContext } from './template'

// ---------------------------------------------------------------------------
// Resend client singleton
// ---------------------------------------------------------------------------

const apiKey = process.env.CRM_RESEND_API_KEY
if (!apiKey && process.env.NODE_ENV === 'production') {
  throw new Error('[CRM] CRM_RESEND_API_KEY environment variable is required in production')
}

const resend = new Resend(apiKey ?? 'test-no-api-key')

// ---------------------------------------------------------------------------
// Default sender
// ---------------------------------------------------------------------------

const DEFAULT_FROM =
  process.env.CRM_FROM_EMAIL ?? 'Ebright OSC <noreply@ebright.my>'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  /** Pre-rendered HTML body */
  html: string
  /** Overrides branch from_email or the module default */
  from?: string
  replyTo?: string
}

// ---------------------------------------------------------------------------
// sendEmail
// ---------------------------------------------------------------------------

/**
 * Send a transactional email via Resend.
 *
 * @returns Resend email ID for tracking / audit
 * @throws  On API errors (non-2xx from Resend)
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ id: string }> {
  const { to, subject, html, from, replyTo } = options

  const payload: Parameters<typeof resend.emails.send>[0] = {
    from: from ?? DEFAULT_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  }

  if (replyTo) {
    payload.replyTo = replyTo
  }

  const { data, error } = await resend.emails.send(payload)

  if (error) {
    throw new Error(`[CRM Email] Resend error: ${error.message}`)
  }

  if (!data?.id) {
    throw new Error('[CRM Email] Resend returned no email ID')
  }

  return { id: data.id }
}

// ---------------------------------------------------------------------------
// sendTemplatedEmail
// ---------------------------------------------------------------------------

/**
 * Render a merge-tag template string then send via Resend.
 *
 * @param opts.to           Recipient email address
 * @param opts.templateBody Raw template string with `{{tag}}` placeholders
 * @param opts.subject      Email subject (not template-rendered; supply a plain string)
 * @param opts.ctx          Template context for merge-tag resolution
 * @param opts.from         Optional sender override
 */
export async function sendTemplatedEmail(opts: {
  to: string
  templateBody: string
  subject: string
  ctx: TemplateContext
  from?: string
}): Promise<{ id: string }> {
  const { to, templateBody, subject, ctx, from } = opts

  const html = renderTemplate(templateBody, ctx)

  return sendEmail({ to, subject, html, from })
}

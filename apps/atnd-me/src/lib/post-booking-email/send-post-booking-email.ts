import type { BasePayload } from 'payload'
import { render } from '@react-email/components'
import { PostBookingEmailLayout } from '@/emails/post-booking-email'
import { sanitizeEmailFromForTenantDomain } from '@/lib/resend/resolveTenantEmailFrom'
import { renderPostBookingEmailBodyHtml } from './render-body-html'
import {
  replaceTemplateVars,
  type TemplateContext,
} from './replace-template-vars'

/** Fields used by the shared renderer/sender (timing is handled by callers). */
export type SendableEmailConfig = {
  emailTo?: string | null
  cc?: string | null
  bcc?: string | null
  replyTo?: string | null
  emailFrom?: string | null
  subject?: string | null
  message?: unknown
}

export type TenantEmailFromGate = {
  domain?: string | null
  verified?: boolean | null
}

function userEmailFromBookingUser(user: unknown): string | null {
  if (user && typeof user === 'object' && 'email' in user) {
    const email = (user as { email?: unknown }).email
    if (typeof email === 'string') {
      const trimmed = email.trim()
      if (trimmed.length > 0) return trimmed
    }
  }
  return null
}

function splitCommaSeparated(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length > 0 ? parts : undefined
}

function applyTemplate(
  value: string | null | undefined,
  context: TemplateContext | null | undefined,
  options?: { escapeHtml?: boolean },
): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return replaceTemplateVars(trimmed, context, options).trim()
}

export async function sendPostBookingEmail({
  payload,
  user,
  config,
  tenantEmailFrom,
  templateContext,
}: {
  payload: BasePayload
  user: unknown
  config: SendableEmailConfig
  /** When set, omit emailFrom if it uses an unverified tenant domain. */
  tenantEmailFrom?: TenantEmailFromGate | null
  /** Nested booking (or other) data for `{{path.to.value}}` placeholders. */
  templateContext?: TemplateContext | null
}): Promise<void> {
  const customerEmail = userEmailFromBookingUser(user)
  const configuredTo = applyTemplate(config.emailTo, templateContext)
  const to = configuredTo || customerEmail
  if (!to) {
    payload.logger.warn(
      '[post-booking-email] Skipping send — no recipient (emailTo unresolved and booking user has no email)',
    )
    return
  }

  const subject = applyTemplate(config.subject, templateContext)
  if (!subject) {
    payload.logger.warn('[post-booking-email] Skipping send — subject is empty')
    return
  }

  const bodyHtml = renderPostBookingEmailBodyHtml(config.message, templateContext)
  if (!bodyHtml.trim()) {
    payload.logger.warn('[post-booking-email] Skipping send — message is empty')
    return
  }

  const html = await render(
    PostBookingEmailLayout({
      subject,
      bodyHtml,
    }),
  )

  const cc = splitCommaSeparated(applyTemplate(config.cc, templateContext))
  const bcc = splitCommaSeparated(applyTemplate(config.bcc, templateContext))
  const rawFrom = applyTemplate(config.emailFrom, templateContext) || undefined
  const from = tenantEmailFrom
    ? sanitizeEmailFromForTenantDomain({
        emailFrom: rawFrom,
        tenantDomain: tenantEmailFrom.domain,
        emailDomainVerified: tenantEmailFrom.verified,
      })
    : rawFrom
  const replyTo = applyTemplate(config.replyTo, templateContext) || undefined

  await payload.sendEmail({
    to,
    subject,
    html,
    ...(from ? { from } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
  })
}

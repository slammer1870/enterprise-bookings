import type { BasePayload } from 'payload'
import { render } from '@react-email/components'
import { PostBookingEmailLayout } from '@/emails/post-booking-email'
import { sanitizeEmailFromForTenantDomain } from '@/lib/resend/resolveTenantEmailFrom'
import { renderPostBookingEmailBodyHtml } from './render-body-html'

/** Fields used by the shared renderer/sender (timing is handled by callers). */
export type SendableEmailConfig = {
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

export async function sendPostBookingEmail({
  payload,
  user,
  config,
  tenantEmailFrom,
}: {
  payload: BasePayload
  user: unknown
  config: SendableEmailConfig
  /** When set, omit emailFrom if it uses an unverified tenant domain. */
  tenantEmailFrom?: TenantEmailFromGate | null
}): Promise<void> {
  const to = userEmailFromBookingUser(user)
  if (!to) {
    payload.logger.warn('[post-booking-email] Skipping send — booking user has no email')
    return
  }

  const subject = typeof config.subject === 'string' ? config.subject.trim() : ''
  if (!subject) {
    payload.logger.warn('[post-booking-email] Skipping send — subject is empty')
    return
  }

  const bodyHtml = renderPostBookingEmailBodyHtml(config.message)
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

  const cc = splitCommaSeparated(config.cc)
  const bcc = splitCommaSeparated(config.bcc)
  const rawFrom = typeof config.emailFrom === 'string' ? config.emailFrom.trim() : undefined
  const from = tenantEmailFrom
    ? sanitizeEmailFromForTenantDomain({
        emailFrom: rawFrom,
        tenantDomain: tenantEmailFrom.domain,
        emailDomainVerified: tenantEmailFrom.verified,
      })
    : rawFrom
  const replyTo = typeof config.replyTo === 'string' ? config.replyTo.trim() : undefined

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

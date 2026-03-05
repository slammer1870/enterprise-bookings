export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  from?: string
}

import { formatFrom, resolveBetterAuthEmailConfig } from './config'

function isUnverifiedDomainError(status: number, body: string): boolean {
  if (status !== 403) return false
  const s = (body || '').toLowerCase()
  return s.includes('domain is not verified') || s.includes('not verified')
}

/**
 * Minimal Resend email sender used by Better Auth hooks (magic-link, etc).
 */
export async function sendEmail({ to, subject, html, from }: SendEmailArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not set (required to send auth emails in production)')
    }
    console.warn('RESEND_API_KEY not set; skipping email send (non-production)')
    return
  }

  const cfg = resolveBetterAuthEmailConfig()
  const defaultFrom = formatFrom(cfg.fromName, cfg.fromAddress)
  const requestedFrom = from || defaultFrom

  const sendOnce = async (fromValue: string) => {
    return await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromValue,
        to: [to],
        subject,
        html,
      }),
    })
  }

  const res = await sendOnce(requestedFrom)

  if (res.ok) return

  const body = await res.text().catch(() => '')

  // If caller requested a custom From domain and Resend rejects it (unverified),
  // retry once using the default configured From.
  if (from && defaultFrom && requestedFrom !== defaultFrom && isUnverifiedDomainError(res.status, body)) {
    console.warn(
      `Resend rejected From domain; retrying with default from. ` +
        `Requested="${requestedFrom}" Default="${defaultFrom}"`
    )
    const retry = await sendOnce(defaultFrom)
    if (retry.ok) return
    const retryBody = await retry.text().catch(() => '')
    throw new Error(
      `Failed to send email via Resend: ${retry.status} ${retry.statusText} ${retryBody}`
    )
  }

  throw new Error(`Failed to send email via Resend: ${res.status} ${res.statusText} ${body}`)
}



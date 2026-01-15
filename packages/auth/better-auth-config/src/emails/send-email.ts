export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  from?: string
}

import { formatFrom, resolveBetterAuthEmailConfig } from './config'

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
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || formatFrom(cfg.fromName, cfg.fromAddress),
      to: [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Failed to send email via Resend: ${res.status} ${res.statusText} ${body}`)
  }
}



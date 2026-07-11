import type { PostBookingEmailSendTiming } from '@/fields/postBookingEmailFields'

export type PostBookingEmailBatchContext = {
  batchSize: number
  batchIndex: number
}

export type PostBookingEmailConfig = {
  cc?: string | null
  bcc?: string | null
  replyTo?: string | null
  emailFrom?: string | null
  subject?: string | null
  message?: unknown
  sendTiming?: PostBookingEmailSendTiming | null
}

export type PostBookingEmailJobInput = {
  deliveryId: number
  userId: number
  timeslotId: number
  tenantId: number
  eventTypeId: number
  bookingId?: number
}

export function resolveActivePostBookingEmailConfig(
  eventType: { postBookingEmails?: PostBookingEmailConfig[] | null },
): PostBookingEmailConfig | null {
  const emails = eventType.postBookingEmails
  if (!Array.isArray(emails) || emails.length === 0) {
    return null
  }

  const entry = emails[0]
  if (!entry?.subject?.trim() || !entry.sendTiming || !entry.replyTo?.trim()) {
    return null
  }

  return entry
}

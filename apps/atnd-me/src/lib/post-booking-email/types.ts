import type { PostBookingEmailSendTiming } from '@/fields/postBookingEmailFields'

export type PostBookingEmailBatchContext = {
  batchSize: number
  batchIndex: number
}

export type PostBookingEmailConfig = {
  id?: string | null
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
  emailConfigId: string
  bookingId?: number
}

function isValidPostBookingEmailConfig(entry: PostBookingEmailConfig | null | undefined): entry is PostBookingEmailConfig & {
  id: string
  subject: string
  replyTo: string
  sendTiming: PostBookingEmailSendTiming
} {
  return Boolean(
    entry?.id &&
      entry.subject?.trim() &&
      entry.sendTiming &&
      entry.replyTo?.trim(),
  )
}

export function resolveActivePostBookingEmailConfigs(
  eventType: { postBookingEmails?: PostBookingEmailConfig[] | null },
): Array<PostBookingEmailConfig & { id: string; subject: string; replyTo: string; sendTiming: PostBookingEmailSendTiming }> {
  const emails = eventType.postBookingEmails
  if (!Array.isArray(emails)) return []
  return emails.filter(isValidPostBookingEmailConfig)
}

export function resolvePostBookingEmailConfigById(
  eventType: { postBookingEmails?: PostBookingEmailConfig[] | null },
  emailConfigId: string,
): (PostBookingEmailConfig & { id: string; subject: string; replyTo: string; sendTiming: PostBookingEmailSendTiming }) | null {
  return resolveActivePostBookingEmailConfigs(eventType).find((entry) => entry.id === emailConfigId) ?? null
}

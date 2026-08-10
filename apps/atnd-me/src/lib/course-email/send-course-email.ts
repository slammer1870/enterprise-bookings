import type { BasePayload } from 'payload'
import {
  sendPostBookingEmail,
  type TenantEmailFromGate,
} from '@/lib/post-booking-email/send-post-booking-email'
import type { CourseEmailConfig } from './types'

/** Reuse post-booking email renderer/sender — same subject + Lexical message shape. */
export async function sendCourseEmail({
  payload,
  user,
  config,
  tenantId,
  tenantEmailFrom,
}: {
  payload: BasePayload
  user: unknown
  config: CourseEmailConfig
  tenantId?: number | string | null
  tenantEmailFrom?: TenantEmailFromGate | null
}): Promise<void> {
  await sendPostBookingEmail({ payload, user, config, tenantId, tenantEmailFrom })
}

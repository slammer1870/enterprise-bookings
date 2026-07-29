import type { BasePayload } from 'payload'
import { sendPostBookingEmail } from '@/lib/post-booking-email/send-post-booking-email'
import type { CourseEmailConfig } from './types'

/** Reuse post-booking email renderer/sender — same subject + Lexical message shape. */
export async function sendCourseEmail({
  payload,
  user,
  config,
}: {
  payload: BasePayload
  user: unknown
  config: CourseEmailConfig
}): Promise<void> {
  await sendPostBookingEmail({ payload, user, config })
}

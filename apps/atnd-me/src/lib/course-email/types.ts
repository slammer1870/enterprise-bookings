import type { CourseEmailSendTiming } from '@/lib/course-email/resolve-send-time'

export type CourseEmailConfig = {
  id?: string | null
  cc?: string | null
  bcc?: string | null
  replyTo?: string | null
  emailFrom?: string | null
  subject?: string | null
  message?: unknown
  sendTiming?: CourseEmailSendTiming | null
}

export type CourseEmailJobInput = {
  deliveryId: number
  userId: number
  enrollmentId: number
  tenantId: number
  courseId: number
  emailConfigId: string
}

export type ActiveCourseEmailConfig = CourseEmailConfig & {
  id: string
  subject: string
  replyTo: string
  sendTiming: CourseEmailSendTiming
}

function isValidCourseEmailConfig(
  entry: CourseEmailConfig | null | undefined,
): entry is ActiveCourseEmailConfig {
  return Boolean(
    entry?.id && entry.subject?.trim() && entry.sendTiming && entry.replyTo?.trim(),
  )
}

export function resolveActiveCourseEmailConfigs(course: {
  courseEmails?: CourseEmailConfig[] | null
}): ActiveCourseEmailConfig[] {
  const emails = course.courseEmails
  if (!Array.isArray(emails)) return []
  return emails.filter(isValidCourseEmailConfig)
}

export function resolveCourseEmailConfigById(
  course: { courseEmails?: CourseEmailConfig[] | null },
  emailConfigId: string,
): ActiveCourseEmailConfig | null {
  return (
    resolveActiveCourseEmailConfigs(course).find((entry) => entry.id === emailConfigId) ?? null
  )
}

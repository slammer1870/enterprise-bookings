import type { TaskHandler } from 'payload'
import { COURSE_EMAIL_DELIVERIES_SLUG } from '@/collections/CourseEmailDeliveries'
import { sendCourseEmail } from '@/lib/course-email/send-course-email'
import type { CourseEmailConfig, CourseEmailJobInput } from '@/lib/course-email/types'
import { resolveCourseEmailConfigById } from '@/lib/course-email/types'

export const sendCourseEmailTask: TaskHandler<'sendCourseEmail'> = async ({ input, req }) => {
  const jobInput = input as CourseEmailJobInput
  const { deliveryId, userId, enrollmentId, emailConfigId, courseId } = jobInput

  const delivery = await req.payload.findByID({
    collection: COURSE_EMAIL_DELIVERIES_SLUG,
    id: deliveryId,
    depth: 0,
    overrideAccess: true,
  })

  if (!delivery || delivery.status !== 'scheduled') {
    return { output: { skipped: true, reason: 'delivery_not_scheduled' } }
  }

  const enrollment = await req.payload
    .findByID({
      collection: 'course-enrollments' as import('payload').CollectionSlug,
      id: enrollmentId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!enrollment || enrollment.status !== 'active') {
    await req.payload.update({
      collection: COURSE_EMAIL_DELIVERIES_SLUG,
      id: deliveryId,
      data: { status: 'cancelled' },
      overrideAccess: true,
      req,
    })
    return { output: { skipped: true, reason: 'enrollment_not_active' } }
  }

  const course = await req.payload.findByID({
    collection: 'courses' as import('payload').CollectionSlug,
    id: courseId,
    depth: 0,
    overrideAccess: true,
  })

  const config = resolveCourseEmailConfigById(
    course as { courseEmails?: CourseEmailConfig[] | null },
    emailConfigId,
  )
  if (!config) {
    return { output: { skipped: true, reason: 'email_disabled' } }
  }

  const user = await req.payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })

  await sendCourseEmail({
    payload: req.payload,
    user,
    config,
  })

  await req.payload.update({
    collection: COURSE_EMAIL_DELIVERIES_SLUG,
    id: deliveryId,
    data: {
      status: 'sent',
      sentAt: new Date().toISOString(),
    },
    overrideAccess: true,
    req,
  })

  return { output: { sent: true } }
}

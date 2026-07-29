import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'
import { COURSE_EMAIL_DELIVERIES_SLUG } from '@/collections/CourseEmailDeliveries'
import { resolveCourseEmailSendAt } from '@/lib/course-email/resolve-send-time'
import { isCancelledEnrollmentTransition } from '@/lib/course-email/cancel-transition'
import { maybeCancelScheduledCourseEmails } from '@/lib/course-email/cancel-scheduled-course-email'
import { sendCourseEmail } from '@/lib/course-email/send-course-email'
import {
  resolveActiveCourseEmailConfigs,
  type ActiveCourseEmailConfig,
} from '@/lib/course-email/types'
import { resolveTimeZone } from '@repo/shared-utils'

function relationId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number') return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  return null
}

function scheduleOnNextEventLoop(fn: () => void): void {
  const g = globalThis as typeof globalThis & {
    setImmediate?: (_cb: () => void) => void
  }
  if (typeof g.setImmediate === 'function') {
    g.setImmediate(fn)
  } else {
    setTimeout(fn, 0)
  }
}

function isActiveEnrollmentTransition({
  doc,
  previousDoc,
  operation,
}: {
  doc: { status?: string }
  previousDoc?: { status?: string } | null
  operation: 'create' | 'update'
}): boolean {
  if (doc.status !== 'active') return false
  if (operation === 'create') return true
  return previousDoc?.status !== 'active'
}

async function findExistingDelivery(
  req: PayloadRequest,
  key: {
    tenantId: number
    userId: number
    enrollmentId: number
    courseId: number
    emailConfigId: string
  },
) {
  const result = await req.payload.find({
    collection: COURSE_EMAIL_DELIVERIES_SLUG,
    where: {
      and: [
        { tenant: { equals: key.tenantId } },
        { user: { equals: key.userId } },
        { enrollment: { equals: key.enrollmentId } },
        { course: { equals: key.courseId } },
        { emailConfigId: { equals: key.emailConfigId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

async function maybeTriggerSingleCourseEmail({
  req,
  enrollmentId,
  courseId,
  tenantId,
  userId,
  user,
  accessStartsAt,
  accessEndsAt,
  timeZone,
  config,
}: {
  req: PayloadRequest
  enrollmentId: number
  courseId: number
  tenantId: number
  userId: number
  user: unknown
  accessStartsAt: string
  accessEndsAt: string
  timeZone: string
  config: ActiveCourseEmailConfig
}): Promise<void> {
  const existing = await findExistingDelivery(req, {
    tenantId,
    userId,
    enrollmentId,
    courseId,
    emailConfigId: config.id,
  })
  if (existing) return

  const sendAt = resolveCourseEmailSendAt({
    sendTiming: config.sendTiming,
    accessStartsAt,
    accessEndsAt,
    timeZone,
  })

  if (sendAt.kind === 'skip') return

  if (sendAt.kind === 'immediate') {
    const delivery = await req.payload.create({
      collection: COURSE_EMAIL_DELIVERIES_SLUG,
      data: {
        tenant: tenantId,
        user: userId,
        enrollment: enrollmentId,
        course: courseId,
        emailConfigId: config.id,
        sendTiming: config.sendTiming,
        status: 'scheduled',
      },
      overrideAccess: true,
      req,
    })

    scheduleOnNextEventLoop(() => {
      void (async () => {
        try {
          await sendCourseEmail({ payload: req.payload, user, config })
          await req.payload.update({
            collection: COURSE_EMAIL_DELIVERIES_SLUG,
            id: delivery.id,
            data: { status: 'sent', sentAt: new Date().toISOString() },
            overrideAccess: true,
          })
        } catch (err) {
          req.payload.logger?.error?.(
            `[course-email] immediate send failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          )
          await req.payload
            .delete({
              collection: COURSE_EMAIL_DELIVERIES_SLUG,
              id: delivery.id,
              overrideAccess: true,
            })
            .catch(() => {})
        }
      })()
    })
    return
  }

  const delivery = await req.payload.create({
    collection: COURSE_EMAIL_DELIVERIES_SLUG,
    data: {
      tenant: tenantId,
      user: userId,
      enrollment: enrollmentId,
      course: courseId,
      emailConfigId: config.id,
      sendTiming: config.sendTiming,
      status: 'scheduled',
      scheduledFor: sendAt.sendAt.toISOString(),
    },
    overrideAccess: true,
    req,
  })

  const job = await req.payload.jobs.queue({
    task: 'sendCourseEmail',
    input: {
      deliveryId: delivery.id,
      userId,
      enrollmentId,
      tenantId,
      courseId,
      emailConfigId: config.id,
    },
    waitUntil: sendAt.sendAt,
    req,
  })

  if (job?.id != null) {
    await req.payload.update({
      collection: COURSE_EMAIL_DELIVERIES_SLUG,
      id: delivery.id,
      data: { payloadJobId: Number(job.id) },
      overrideAccess: true,
      req,
    })
  }
}

export const triggerCourseEmailAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (
    isCancelledEnrollmentTransition({
      doc,
      previousDoc,
      operation,
    })
  ) {
    const enrollmentId = relationId(doc.id)
    if (enrollmentId != null) {
      await maybeCancelScheduledCourseEmails(req, enrollmentId)
    }
    return doc
  }

  if (!isActiveEnrollmentTransition({ doc, previousDoc, operation })) {
    return doc
  }

  const enrollmentId = relationId(doc.id)
  const userId = relationId(doc.user)
  const courseId = relationId(doc.course)
  const tenantId = relationId(doc.tenant)
  const accessStartsAt =
    typeof doc.accessStartsAt === 'string' ? doc.accessStartsAt : null
  const accessEndsAt = typeof doc.accessEndsAt === 'string' ? doc.accessEndsAt : null

  if (
    enrollmentId == null ||
    userId == null ||
    courseId == null ||
    tenantId == null ||
    !accessStartsAt ||
    !accessEndsAt
  ) {
    return doc
  }

  const course = await req.payload
    .findByID({
      collection: 'courses' as import('payload').CollectionSlug,
      id: courseId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  const configs = resolveActiveCourseEmailConfigs(
    course as { courseEmails?: Parameters<typeof resolveActiveCourseEmailConfigs>[0]['courseEmails'] },
  )
  if (configs.length === 0) return doc

  const tenant = await req.payload
    .findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  const timeZone = resolveTimeZone(
    tenant && typeof tenant === 'object' && 'timeZone' in tenant
      ? (tenant as { timeZone?: string | null }).timeZone || undefined
      : undefined,
  )

  const user = await req.payload
    .findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  for (const config of configs) {
    await maybeTriggerSingleCourseEmail({
      req,
      enrollmentId,
      courseId,
      tenantId,
      userId,
      user,
      accessStartsAt,
      accessEndsAt,
      timeZone,
      config,
    })
  }

  return doc
}

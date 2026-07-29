/**
 * Assign a course enrollment after a successful course_purchase Checkout / PaymentIntent.
 */
import type { Payload } from 'payload'
import { buildCourseEnrollmentFromPurchase } from '@repo/bookings-payments'

export type AssignCourseEnrollmentFromPurchaseResult =
  | { assigned: true; enrollmentId: number | string }
  | { assigned: false; reason: string }

function parsePositiveInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return null
}

export async function assignCourseEnrollmentFromPurchase(params: {
  payload: Payload
  tenantId: number
  metadata: Record<string, string | undefined>
  transactionId: string
  tenantContext?: { tenant: number } | null
  purchasedAt?: Date
}): Promise<AssignCourseEnrollmentFromPurchaseResult> {
  const { payload, tenantId, metadata: meta, transactionId, tenantContext } = params
  const purchasedAt = params.purchasedAt ?? new Date()

  if (meta.type !== 'course_purchase') {
    return { assigned: false, reason: 'not_course_purchase' }
  }

  const userId = parsePositiveInt(meta.userId)
  const courseId = parsePositiveInt(meta.courseId)
  if (userId == null || courseId == null) {
    payload.logger?.error?.(
      `course_purchase: missing userId/courseId for transaction ${transactionId}`,
    )
    return { assigned: false, reason: 'missing_metadata' }
  }

  const existing = await payload.find({
    collection: 'course-enrollments' as import('payload').CollectionSlug,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { transactionId: { equals: transactionId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs[0]) {
    return { assigned: true, enrollmentId: existing.docs[0].id as number | string }
  }

  const course = (await payload
    .findByID({
      collection: 'courses' as import('payload').CollectionSlug,
      id: courseId,
      depth: 0,
      overrideAccess: true,
      ...(tenantContext ? { context: tenantContext } : {}),
    })
    .catch(() => null)) as {
    startDate?: string | null
    endDate?: string | null
    durationLength?: number | null
    durationUnit?: 'days' | 'weeks' | null
    status?: string | null
    maxEnrollments?: number | null
  } | null

  if (!course) {
    return { assigned: false, reason: 'course_not_found' }
  }
  if (course.status === 'archived' || course.status === 'closed' || course.status === 'draft') {
    return { assigned: false, reason: 'course_not_open' }
  }

  if (typeof course.maxEnrollments === 'number' && course.maxEnrollments >= 1) {
    const activeCount = await payload.find({
      collection: 'course-enrollments' as import('payload').CollectionSlug,
      where: {
        and: [
          { course: { equals: courseId } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    if ((activeCount.totalDocs ?? 0) >= course.maxEnrollments) {
      return { assigned: false, reason: 'sold_out' }
    }
  }

  let enrollmentData
  try {
    enrollmentData = buildCourseEnrollmentFromPurchase({
      userId,
      courseId,
      tenantId,
      purchasedAt,
      transactionId,
      course: {
        startDate: course.startDate,
        endDate: course.endDate,
        durationLength: course.durationLength,
        durationUnit: course.durationUnit,
      },
    })
  } catch (err) {
    payload.logger?.error?.(
      `course_purchase: invalid duration for course ${courseId}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return { assigned: false, reason: 'invalid_course_duration' }
  }

  const created = await payload.create({
    collection: 'course-enrollments' as import('payload').CollectionSlug,
    draft: false,
    data: enrollmentData as Record<string, unknown>,
    overrideAccess: true,
    ...(tenantContext ? { context: tenantContext } : {}),
  })

  return { assigned: true, enrollmentId: created.id as number | string }
}

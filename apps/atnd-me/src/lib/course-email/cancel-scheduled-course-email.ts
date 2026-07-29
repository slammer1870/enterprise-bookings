import type { PayloadRequest } from 'payload'
import { COURSE_EMAIL_DELIVERIES_SLUG } from '@/collections/CourseEmailDeliveries'

async function findCourseEmailJobByDeliveryId(
  req: PayloadRequest,
  deliveryId: number,
): Promise<{ id: number } | null> {
  const result = await req.payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { taskSlug: { equals: 'sendCourseEmail' } },
        { completedAt: { exists: false } },
      ],
    },
    sort: '-createdAt',
    limit: 25,
    depth: 0,
    overrideAccess: true,
  })

  const match = result.docs.find((doc) => {
    const input = doc.input
    if (input == null || typeof input !== 'object' || Array.isArray(input)) return false
    const deliveryIdFromInput = (input as { deliveryId?: unknown }).deliveryId
    return deliveryIdFromInput === deliveryId || deliveryIdFromInput === String(deliveryId)
  })

  return match?.id != null ? { id: match.id as number } : null
}

async function cancelPayloadJob(req: PayloadRequest, jobId: number): Promise<void> {
  const jobsApi = req.payload.jobs as {
    cancelByID?: (args: { id: number | string; req?: PayloadRequest }) => Promise<unknown>
  }
  if (typeof jobsApi.cancelByID === 'function') {
    try {
      await jobsApi.cancelByID({ id: jobId, req })
      return
    } catch {
      // fall through
    }
  }
  await req.payload.delete({
    collection: 'payload-jobs',
    id: jobId,
    overrideAccess: true,
    req,
  })
}

export async function maybeCancelScheduledCourseEmails(
  req: PayloadRequest,
  enrollmentId: number,
): Promise<void> {
  const scheduled = await req.payload.find({
    collection: COURSE_EMAIL_DELIVERIES_SLUG,
    where: {
      and: [
        { enrollment: { equals: enrollmentId } },
        { status: { equals: 'scheduled' } },
      ],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  for (const delivery of scheduled.docs) {
    const deliveryId = delivery.id as number
    const job =
      typeof delivery.payloadJobId === 'number'
        ? { id: delivery.payloadJobId }
        : await findCourseEmailJobByDeliveryId(req, deliveryId)
    if (job) {
      await cancelPayloadJob(req, job.id)
    }
    await req.payload.update({
      collection: COURSE_EMAIL_DELIVERIES_SLUG,
      id: deliveryId,
      data: { status: 'cancelled' },
      overrideAccess: true,
      req,
    })
  }
}

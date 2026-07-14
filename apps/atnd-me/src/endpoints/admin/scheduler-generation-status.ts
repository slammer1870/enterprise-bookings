import type { Endpoint, PayloadRequest } from 'payload'
import { APIError } from 'payload'

import { buildSchedulerGenerationStatus } from '@/lib/scheduler/generation-job-status'
import {
  jobInputMatchesScheduler,
  resolveSchedulerGenerationJob,
} from '@/lib/scheduler/match-generation-job'
import type { PayloadJob, Scheduler } from '@/payload-types'

export const schedulerGenerationStatusEndpoint: Endpoint = {
  path: '/:id/generation-status',
  method: 'get',
  handler: async (req) => {
    if (!req.user) {
      throw new APIError('Unauthorized', 401)
    }

    const rawId = req.routeParams?.id
    const schedulerId =
      typeof rawId === 'number'
        ? rawId
        : typeof rawId === 'string' && /^\d+$/.test(rawId)
          ? parseInt(rawId, 10)
          : null

    if (schedulerId == null) {
      throw new APIError('Scheduler id is required', 400)
    }

    const scheduler = (await req.payload.findByID({
      collection: 'scheduler',
      id: schedulerId,
      depth: 0,
      overrideAccess: false,
      req,
    }).catch(() => null)) as Scheduler | null

    if (!scheduler) {
      throw new APIError('Scheduler not found', 404)
    }

    const lastJobId = (scheduler as Scheduler & { lastGenerationJobId?: number | null })
      .lastGenerationJobId
    const generationProgress = (scheduler as Scheduler & { generationProgress?: unknown })
      .generationProgress

    let lastJob: PayloadJob | null = null
    if (lastJobId != null && Number.isFinite(lastJobId)) {
      lastJob = (await req.payload
        .findByID({
          collection: 'payload-jobs',
          id: lastJobId,
          depth: 0,
          overrideAccess: true,
          req,
        })
        .catch(() => null)) as PayloadJob | null
    }

    const latestJob = await findLatestGenerationJobForScheduler(req, scheduler)
    const job = resolveSchedulerGenerationJob(lastJob, latestJob)

    return Response.json(
      buildSchedulerGenerationStatus({
        lastGenerationJobId: lastJobId,
        generationProgress,
        job,
      }),
    )
  },
}

async function findLatestGenerationJobForScheduler(
  req: PayloadRequest,
  scheduler: Scheduler,
): Promise<PayloadJob | null> {
  const tenantId =
    typeof scheduler.tenant === 'object' && scheduler.tenant !== null
      ? scheduler.tenant.id
      : scheduler.tenant
  const branchId =
    typeof scheduler.branch === 'object' && scheduler.branch !== null
      ? scheduler.branch.id
      : scheduler.branch

  const result = await req.payload.find({
    collection: 'payload-jobs',
    where: {
      taskSlug: { equals: 'generateTimeslotsFromSchedule' },
    },
    sort: '-createdAt',
    limit: 25,
    depth: 0,
    overrideAccess: true,
    req,
  })

  const docs = result.docs as PayloadJob[]
  const match = docs.find((doc) =>
    jobInputMatchesScheduler(doc.input, scheduler.id, tenantId, branchId),
  )
  return match ?? null
}

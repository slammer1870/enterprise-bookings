import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { SKIP_SCHEDULER_GENERATION } from '@/lib/scheduler/constants'

function toNumericId(value: string | number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  return null
}

async function persistLastGenerationJobId(args: {
  payload: Payload
  req: PayloadRequest
  schedulerId?: number | string
  jobId: string | number
}): Promise<void> {
  const { payload, req, schedulerId, jobId } = args
  if (schedulerId == null) return

  const numericJobId = toNumericId(jobId)
  if (numericJobId == null) return

  try {
    await payload.update({
      collection: 'scheduler',
      id: schedulerId,
      data: { lastGenerationJobId: numericJobId },
      context: { [SKIP_SCHEDULER_GENERATION]: true },
      overrideAccess: true,
      req,
    })
  } catch {
    // Best-effort — status endpoint can still fall back to recent jobs.
  }
}

/**
 * Build a standalone Payload request for background scheduler jobs.
 * Avoids reusing the save HTTP request, which can be aborted once the admin
 * response is sent or the user navigates away.
 */
export async function createSchedulerGenerationRequest(
  payload: Payload,
  args: {
    user: PayloadRequest['user']
    tenantId?: number | string | null
  },
): Promise<PayloadRequest> {
  const context: Record<string, unknown> = {}
  if (args.tenantId != null) {
    context.tenant = args.tenantId
  }

  return createLocalReq(
    {
      user: args.user ?? undefined,
      context,
    },
    payload,
  )
}

/** Fire-and-forget: run a queued generation job on an isolated request. */
export function runSchedulerGenerationJob(args: {
  payload: Payload
  jobId: string | number
  user: PayloadRequest['user']
  tenantId?: number | string | null
  schedulerId?: number | string
}): void {
  void (async () => {
    const req = await createSchedulerGenerationRequest(args.payload, {
      user: args.user,
      tenantId: args.tenantId,
    })
    req.context = {
      ...(req.context ?? {}),
      generationJobId: args.jobId,
    }

    await persistLastGenerationJobId({
      payload: args.payload,
      req,
      schedulerId: args.schedulerId,
      jobId: args.jobId,
    })

    await args.payload.jobs.runByID({
      id: args.jobId,
      req,
    })
  })().catch((error: unknown) => {
    args.payload.logger.error(
      {
        err: error,
        jobId: args.jobId,
        schedulerId: args.schedulerId,
      },
      'Scheduler timeslot generation job failed to run',
    )
  })
}

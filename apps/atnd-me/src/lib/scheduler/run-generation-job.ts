import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

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

    // Intentionally do not write lastGenerationJobId onto the scheduler document
    // here — concurrent updates while the edit form is open reintroduce phantom
    // empty timeSlot rows. The status endpoint finds the job via recent jobs.

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

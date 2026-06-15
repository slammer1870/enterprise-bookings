import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { parseGenerationJobStatus } from '@/lib/scheduler/generation-job-status'
import { createSchedulerGenerationRequest } from '@/lib/scheduler/run-generation-job'
import type { EventType, PayloadJob, User } from '@repo/shared-types'

const TEST_TIMEOUT = 180000
const HOOK_TIMEOUT = 300000

function emptyWeekDays() {
  return Array.from({ length: 7 }, () => ({ timeSlot: [] as never[] }))
}

function withMondaySlot(
  startDate: Date,
  eventTypeId: number,
  days: ReturnType<typeof emptyWeekDays>,
) {
  days[0] = {
    timeSlot: [
      {
        startTime: new Date(startDate.getTime() + 10 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(startDate.getTime() + 11 * 60 * 60 * 1000).toISOString(),
        eventType: eventTypeId,
        location: 'Test Location',
        active: true,
      },
    ],
  }
  return days
}

async function countGeneratedTimeslots(
  payload: Payload,
  tenantId: number | string,
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const result = await payload.find({
    collection: 'timeslots',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { startTime: { greater_than_equal: startDate.toISOString() } },
        { endTime: { less_than_equal: endDate.toISOString() } },
      ],
    },
    limit: 200,
    overrideAccess: true,
  })

  return result.docs.length
}

async function waitForGenerationSuccess(args: {
  payload: Payload
  jobId: number
  tenantId: number | string
  startDate: Date
  endDate: Date
  timeoutMs?: number
}): Promise<{ job: PayloadJob | null; timeslotCount: number }> {
  const { payload, jobId, tenantId, startDate, endDate, timeoutMs = 120000 } = args
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    let job: PayloadJob | null = null

    try {
      job = (await payload.findByID({
        collection: 'payload-jobs',
        id: jobId,
        depth: 0,
        overrideAccess: true,
      })) as PayloadJob

      if (!job.processing && (job.completedAt || job.hasError)) {
        const timeslotCount = await countGeneratedTimeslots(payload, tenantId, startDate, endDate)
        return { job, timeslotCount }
      }
    } catch {
      // Test env deletes jobs on complete (deleteJobOnComplete: true).
      const timeslotCount = await countGeneratedTimeslots(payload, tenantId, startDate, endDate)
      if (timeslotCount > 0) {
        return { job: null, timeslotCount }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Generation job ${jobId} did not complete within ${timeoutMs}ms`)
}

async function deleteSchedulerForTenant(payload: Payload, tenantId: number | string) {
  const existing = await payload.find({
    collection: 'scheduler',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    await payload.delete({
      collection: 'scheduler',
      id: existing.docs[0]!.id,
      overrideAccess: true,
    })
  }
}

describe('Scheduler generation observability', () => {
  let payload: Payload
  let testTenant: { id: number | string; slug: string }
  let eventType: EventType
  let user: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    testTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Scheduler Observability Tenant',
        slug: `scheduler-obs-${Date.now()}`,
      },
      overrideAccess: true,
    })

    eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Observability Class ${Date.now()}`,
        places: 10,
        description: 'Test',
        tenant: Number(testTenant.id),
      },
      overrideAccess: true,
    })) as EventType

    user = (await payload.create({
      collection: 'users',
      data: {
        name: 'Scheduler Observability User',
        email: `scheduler-obs-${Date.now()}@test.com`,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy?.()
    }
  })

  it(
    'stores lastGenerationJobId and reports succeeded status after generation',
    async () => {
      await deleteSchedulerForTenant(payload, testTenant.id)

      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 1)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 6)
      endDate.setHours(23, 59, 59, 999)

      const req = {
        ...payload,
        user,
        context: { tenant: testTenant.id },
      } as Parameters<typeof payload.create>[0]['req']

      const scheduler = await payload.create({
        collection: 'scheduler',
        data: {
          tenant: Number(testTenant.id),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          clearExisting: false,
          defaultEventType: eventType.id,
          lockOutTime: 60,
          week: {
            days: withMondaySlot(startDate, Number(eventType.id), emptyWeekDays()),
          },
        },
        req,
        overrideAccess: true,
      })

      const stored = await payload.findByID({
        collection: 'scheduler',
        id: scheduler.id,
        depth: 0,
        overrideAccess: true,
      })

      const lastJobId = (stored as { lastGenerationJobId?: number | null }).lastGenerationJobId
      expect(lastJobId).toBeTypeOf('number')
      expect(lastJobId).toBeGreaterThan(0)

      const { job, timeslotCount } = await waitForGenerationSuccess({
        payload,
        jobId: lastJobId!,
        tenantId: testTenant.id,
        startDate,
        endDate,
      })

      expect(timeslotCount).toBeGreaterThan(0)

      if (job) {
        const status = parseGenerationJobStatus(job)
        expect(status.status).toBe('succeeded')
        expect(status.jobId).toBe(lastJobId)
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'completes generation for a multi-month range on an isolated request',
    async () => {
      await deleteSchedulerForTenant(payload, testTenant.id)

      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 1)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 74)
      endDate.setHours(23, 59, 59, 999)

      const job = await payload.jobs.queue({
        task: 'generateTimeslotsFromSchedule',
        input: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          week: {
            days: withMondaySlot(startDate, Number(eventType.id), emptyWeekDays()),
          },
          clearExisting: false,
          defaultEventType: eventType.id,
          lockOutTime: 60,
          tenant: Number(testTenant.id),
        },
      })

      expect(job.id).toBeTruthy()

      const req = await createSchedulerGenerationRequest(payload, {
        user,
        tenantId: testTenant.id,
      })

      await payload.jobs.runByID({
        id: job.id,
        req,
      })

      const { job: completedJob, timeslotCount } = await waitForGenerationSuccess({
        payload,
        jobId: Number(job.id),
        tenantId: testTenant.id,
        startDate,
        endDate,
        timeoutMs: 180000,
      })

      expect(timeslotCount).toBeGreaterThan(0)

      if (completedJob) {
        expect(parseGenerationJobStatus(completedJob).status).toBe('succeeded')
      }
    },
    TEST_TIMEOUT,
  )
})

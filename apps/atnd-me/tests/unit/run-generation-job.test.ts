import { describe, it, expect, vi, beforeEach } from 'vitest'

const { createLocalReqMock } = vi.hoisted(() => ({
  createLocalReqMock: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => {
  const original = await importOriginal<typeof import('payload')>()
  return {
    ...original,
    createLocalReq: createLocalReqMock,
  }
})

import {
  createSchedulerGenerationRequest,
  runSchedulerGenerationJob,
} from '@/lib/scheduler/run-generation-job'

describe('createSchedulerGenerationRequest', () => {
  beforeEach(() => {
    createLocalReqMock.mockReset()
    createLocalReqMock.mockImplementation(async (opts, payload) => ({
      user: opts.user,
      context: opts.context ?? {},
      payload,
    }))
  })

  it('passes tenant into isolated request context', async () => {
    const payload = { id: 'test' } as never

    await createSchedulerGenerationRequest(payload, {
      user: { id: 1 } as never,
      tenantId: 42,
    })

    expect(createLocalReqMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { id: 1 },
        context: { tenant: 42 },
      }),
      payload,
    )
  })

  it('omits tenant from context when tenantId is null', async () => {
    const payload = { id: 'test' } as never

    await createSchedulerGenerationRequest(payload, {
      user: null,
      tenantId: null,
    })

    expect(createLocalReqMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
      }),
      payload,
    )
  })
})

describe('runSchedulerGenerationJob', () => {
  beforeEach(() => {
    createLocalReqMock.mockReset()
    createLocalReqMock.mockImplementation(async (opts, payload) => ({
      user: opts.user,
      context: opts.context ?? {},
      payload,
    }))
  })

  it('runs the queued job on an isolated request', async () => {
    const runByID = vi.fn().mockResolvedValue(undefined)
    const payload = {
      jobs: { runByID },
      logger: { error: vi.fn() },
    } as never

    runSchedulerGenerationJob({
      payload,
      jobId: 99,
      user: { id: 1 } as never,
      tenantId: 5,
      schedulerId: 10,
    })

    await vi.waitFor(() => expect(runByID).toHaveBeenCalled())

    expect(runByID).toHaveBeenCalledWith({
      id: 99,
      req: expect.objectContaining({
        context: { tenant: 5, generationJobId: 99 },
        payload,
      }),
    })
  })

  it('logs when runByID rejects', async () => {
    const runByID = vi.fn().mockRejectedValue(new Error('run failed'))
    const logger = { error: vi.fn() }
    const payload = {
      jobs: { runByID },
      logger,
    } as never

    runSchedulerGenerationJob({
      payload,
      jobId: 99,
      user: null,
      tenantId: 5,
      schedulerId: 10,
    })

    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled())

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        jobId: 99,
        schedulerId: 10,
      }),
      'Scheduler timeslot generation job failed to run',
    )
  })
})

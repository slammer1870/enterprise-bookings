import { describe, it, expect } from 'vitest'

import { parseGenerationJobStatus } from '@/lib/scheduler/generation-job-status'
import type { PayloadJob } from '@/payload-types'

function baseJob(overrides: Partial<PayloadJob> = {}): PayloadJob {
  return {
    id: 42,
    updatedAt: '2026-06-15T12:00:00.000Z',
    createdAt: '2026-06-15T11:00:00.000Z',
    ...overrides,
  }
}

describe('parseGenerationJobStatus', () => {
  it('returns idle when job is null or undefined', () => {
    expect(parseGenerationJobStatus(null)).toEqual({ jobId: null, status: 'idle' })
    expect(parseGenerationJobStatus(undefined)).toEqual({ jobId: null, status: 'idle' })
  })

  it('returns processing when job.processing is true', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        processing: true,
        totalTried: 1,
      }),
    )

    expect(result).toMatchObject({
      jobId: 42,
      status: 'processing',
      message: 'Generating timeslots…',
      totalTried: 1,
    })
  })

  it('returns failed when job.hasError is true', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        hasError: true,
        error: 'Database timeout',
        completedAt: '2026-06-15T12:05:00.000Z',
        log: [
          {
            executedAt: '2026-06-15T12:00:00.000Z',
            completedAt: '2026-06-15T12:05:00.000Z',
            taskSlug: 'generateTimeslotsFromSchedule',
            taskID: 'task-1',
            state: 'failed',
            error: 'Database timeout',
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      jobId: 42,
      status: 'failed',
      message: 'Database timeout',
    })
  })

  it('returns succeeded when completed with success log output', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        completedAt: '2026-06-15T12:05:00.000Z',
        log: [
          {
            executedAt: '2026-06-15T12:00:00.000Z',
            completedAt: '2026-06-15T12:05:00.000Z',
            taskSlug: 'generateTimeslotsFromSchedule',
            taskID: 'task-1',
            state: 'succeeded',
            output: { message: 'Timeslots generated successfully' },
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      jobId: 42,
      status: 'succeeded',
      message: 'Timeslots generated successfully',
    })
  })

  it('returns failed when completed with non-success message', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        completedAt: '2026-06-15T12:05:00.000Z',
        log: [
          {
            executedAt: '2026-06-15T12:00:00.000Z',
            completedAt: '2026-06-15T12:05:00.000Z',
            taskSlug: 'generateTimeslotsFromSchedule',
            taskID: 'task-1',
            state: 'succeeded',
            output: { message: 'Branch 99 is not an active location for this tenant' },
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      jobId: 42,
      status: 'failed',
      message: 'Branch 99 is not an active location for this tenant',
    })
  })

  it('extracts error message from failed task log entry', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        completedAt: '2026-06-15T12:05:00.000Z',
        log: [
          {
            executedAt: '2026-06-15T12:00:00.000Z',
            completedAt: '2026-06-15T12:05:00.000Z',
            taskSlug: 'generateTimeslotsFromSchedule',
            taskID: 'task-1',
            state: 'failed',
            error: 'Invalid event type',
          },
        ],
      }),
    )

    expect(result.message).toBe('Invalid event type')
  })

  it('returns idle when job exists but is not processing, failed, or completed', () => {
    const result = parseGenerationJobStatus(baseJob())

    expect(result).toMatchObject({
      jobId: 42,
      status: 'idle',
    })
  })

  it('parses string job ids', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        id: '77' as unknown as number,
        processing: true,
      }),
    )

    expect(result.jobId).toBe(77)
  })
})

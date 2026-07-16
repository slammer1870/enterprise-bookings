import { describe, it, expect } from 'vitest'

import { parseGenerationJobStatus, buildSchedulerGenerationStatus } from '@/lib/scheduler/generation-job-status'
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

  it('falls back to scheduler stored progress when job is missing', () => {
    const result = parseGenerationJobStatus(null, {
      storedProgress: {
        phase: 'planning',
        daysProcessed: 1,
        daysTotal: 10,
        percent: 8,
        updatedAt: '2026-06-15T12:00:00.000Z',
        startedAt: '2026-06-15T11:55:00.000Z',
      },
    })

    expect(result.jobId).toBeNull()
    expect(result.status).toBe('processing')
    expect(result.progress?.phase).toBe('planning')
    expect(result.progressPercent).toBe(8)
    expect(result.message).toMatch(/Planning timeslots/)
  })

  it('treats stored progress phase=done as succeeded when job is missing', () => {
    const result = parseGenerationJobStatus(null, {
      storedProgress: {
        phase: 'done',
        updatedAt: '2026-06-15T12:05:00.000Z',
      },
    })

    expect(result.status).toBe('succeeded')
    expect(result.message).toBe('Generation complete')
  })

  it('returns processing when job.processing is true', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        processing: true,
        totalTried: 1,
        taskStatus: {
          phase: 'creating',
          created: 120,
          total: 480,
          percent: 52,
          startedAt: '2026-06-15T12:00:00.000Z',
          updatedAt: '2026-06-15T12:01:00.000Z',
        },
      }),
    )

    expect(result).toMatchObject({
      jobId: 42,
      status: 'processing',
      message: 'Creating timeslots… 120 / 480',
      totalTried: 1,
      progressPercent: 52,
    })
    expect(result.etaMessage).toMatch(/remaining/)
  })

  it('prefers job taskStatus over legacy scheduler stored progress', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        processing: true,
        taskStatus: {
          phase: 'planning',
          daysProcessed: 1,
          daysTotal: 10,
          percent: 8,
          updatedAt: '2026-06-15T12:00:00.000Z',
        },
      }),
      {
        storedProgress: {
          phase: 'creating',
          created: 400,
          total: 800,
          percent: 68,
          updatedAt: '2026-06-15T12:05:00.000Z',
        },
      },
    )

    expect(result.progress?.phase).toBe('planning')
    expect(result.progressPercent).toBe(8)
    expect(result.message).toMatch(/Planning timeslots/)
  })

  it('returns processing with default message when no taskStatus', () => {
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
      progressPercent: 2,
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
            output: { message: 'Created 12 timeslots · 3 already existed' },
          },
        ],
      }),
    )

    expect(result).toMatchObject({
      jobId: 42,
      status: 'succeeded',
      message: 'Created 12 timeslots · 3 already existed',
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

  it('ignores a completed job when scheduler stored progress is from a newer run', () => {
    const result = parseGenerationJobStatus(
      baseJob({
        id: 3,
        completedAt: '2026-07-12T09:33:00.000Z',
      }),
      {
        storedProgress: {
          phase: 'creating',
          created: 4,
          total: 20,
          percent: 48,
          updatedAt: '2026-07-14T09:36:10.000Z',
          startedAt: '2026-07-14T09:36:00.000Z',
        },
      },
    )

    expect(result.status).toBe('processing')
    expect(result.jobId).toBeNull()
    expect(result.message).toMatch(/Creating timeslots/)
  })

  it('prefers a processing job over legacy stored scheduler progress', () => {
    const result = buildSchedulerGenerationStatus({
      lastGenerationJobId: 12,
      generationProgress: {
        phase: 'creating',
        created: 4,
        total: 20,
        percent: 48,
        updatedAt: '2026-07-14T09:36:10.000Z',
        startedAt: '2026-07-14T09:36:00.000Z',
      },
      job: baseJob({
        id: 12,
        processing: true,
        taskStatus: {
          phase: 'planning',
          daysProcessed: 2,
          daysTotal: 10,
          percent: 10,
          updatedAt: '2026-07-14T09:36:20.000Z',
          startedAt: '2026-07-14T09:36:00.000Z',
        },
      }),
    })

    expect(result.status).toBe('processing')
    expect(result.jobId).toBe(12)
    expect(result.message).toMatch(/Planning timeslots/)
  })

  it('falls back to stored progress when no job is available', () => {
    const result = buildSchedulerGenerationStatus({
      lastGenerationJobId: 12,
      generationProgress: {
        phase: 'creating',
        created: 4,
        total: 20,
        percent: 48,
        updatedAt: '2026-07-14T09:36:10.000Z',
        startedAt: '2026-07-14T09:36:00.000Z',
      },
      job: null,
    })

    expect(result.status).toBe('processing')
    expect(result.jobId).toBe(12)
    expect(result.message).toMatch(/Creating timeslots/)
  })
})

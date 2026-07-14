import { describe, it, expect } from 'vitest'

import type { PayloadJob } from '@/payload-types'
import {
  jobInputMatchesScheduler,
  resolveSchedulerGenerationJob,
} from '@/lib/scheduler/match-generation-job'

function job(id: number, createdAt: string, overrides: Partial<PayloadJob> = {}): PayloadJob {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}

describe('jobInputMatchesScheduler', () => {
  it('matches by scheduler, tenant, and branch ids', () => {
    expect(
      jobInputMatchesScheduler(
        {
          schedulerId: 10,
          tenant: 5,
          branch: 3,
        },
        10,
        5,
        3,
      ),
    ).toBe(true)
  })

  it('rejects jobs for a different scheduler on the same tenant', () => {
    expect(
      jobInputMatchesScheduler(
        {
          schedulerId: 11,
          tenant: 5,
          branch: 3,
        },
        10,
        5,
        3,
      ),
    ).toBe(false)
  })

  it('rejects jobs for a different branch on the same scheduler', () => {
    expect(
      jobInputMatchesScheduler(
        {
          schedulerId: 10,
          tenant: 5,
          branch: 4,
        },
        10,
        5,
        3,
      ),
    ).toBe(false)
  })

  it('accepts jobs without branch when scheduler branch is unset', () => {
    expect(
      jobInputMatchesScheduler(
        {
          schedulerId: 10,
          tenant: 5,
        },
        10,
        5,
        null,
      ),
    ).toBe(true)
  })

  it('accepts legacy jobs without branch metadata for a branched scheduler', () => {
    expect(
      jobInputMatchesScheduler(
        {
          schedulerId: 10,
          tenant: 5,
        },
        10,
        5,
        3,
      ),
    ).toBe(true)
  })
})

describe('resolveSchedulerGenerationJob', () => {
  it('prefers a newer matching job over a stale lastGenerationJobId reference', () => {
    const resolved = resolveSchedulerGenerationJob(
      job(3, '2026-07-12T09:32:54.000Z', { completedAt: '2026-07-12T09:33:00.000Z' }),
      job(12, '2026-07-14T09:36:00.000Z', { processing: true }),
    )

    expect(resolved?.id).toBe(12)
  })

  it('keeps the processing job when it is the stored reference', () => {
    const resolved = resolveSchedulerGenerationJob(
      job(12, '2026-07-14T09:36:00.000Z', { processing: true }),
      job(11, '2026-07-14T09:35:00.000Z', { completedAt: '2026-07-14T09:35:30.000Z' }),
    )

    expect(resolved?.id).toBe(12)
  })
})

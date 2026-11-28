import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RetentionModelScore } from '@/lib/analytics/retentionModel'
import {
  getCachedRetentionScores,
  resetRetentionScoreCacheForTests,
  RETENTION_SCORE_CACHE_TTL_MS,
  type RetentionScoreCacheScope,
} from '@/lib/analytics/retentionScoreCache'

const baseScope: RetentionScoreCacheScope = {
  tenantId: 1,
  branchId: 2,
  predictionYmd: '2026-10-12',
  modelVersion: 'model-v1',
}

const score: RetentionModelScore = {
  bookingPropensity: 0.25,
  outreachPriority: 75,
  belowDecisionThreshold: true,
  modelVersion: 'model-v1',
}

describe('retention score cache', () => {
  beforeEach(() => {
    resetRetentionScoreCacheForTests()
  })

  it('shares an in-flight load and reuses its completed value', async () => {
    let resolveLoad: ((value: Map<number, RetentionModelScore>) => void) | undefined
    const load = vi.fn(
      () =>
        new Promise<Map<number, RetentionModelScore>>((resolve) => {
          resolveLoad = resolve
        }),
    )

    const first = getCachedRetentionScores({ enabled: true, scope: baseScope, load, nowMs: 1_000 })
    const second = getCachedRetentionScores({ enabled: true, scope: baseScope, load, nowMs: 1_001 })

    expect(first).toBe(second)
    expect(load).toHaveBeenCalledTimes(0)
    await Promise.resolve()
    expect(load).toHaveBeenCalledTimes(1)

    resolveLoad?.(new Map([[7, score]]))
    await expect(first).resolves.toEqual(new Map([[7, score]]))

    const third = getCachedRetentionScores({ enabled: true, scope: baseScope, load, nowMs: 2_000 })
    await expect(third).resolves.toEqual(new Map([[7, score]]))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('isolates entries by tenant, branch, date, and model version', async () => {
    const load = vi.fn(async () => new Map([[7, score]]))
    const scopeChanges: RetentionScoreCacheScope[] = [
      { ...baseScope, tenantId: 9 },
      { ...baseScope, branchId: 9 },
      { ...baseScope, predictionYmd: '2026-10-13' },
      { ...baseScope, modelVersion: 'model-v2' },
    ]

    await getCachedRetentionScores({ enabled: true, scope: baseScope, load, nowMs: 1_000 })
    for (const scope of scopeChanges) {
      await getCachedRetentionScores({ enabled: true, scope, load, nowMs: 1_000 })
    }

    expect(load).toHaveBeenCalledTimes(5)
  })

  it('reloads expired entries and bypasses caching when disabled', async () => {
    const load = vi.fn(async () => new Map([[7, score]]))

    await getCachedRetentionScores({ enabled: true, scope: baseScope, load, nowMs: 1_000 })
    await getCachedRetentionScores({
      enabled: true,
      scope: baseScope,
      load,
      nowMs: 1_000 + RETENTION_SCORE_CACHE_TTL_MS,
    })
    await getCachedRetentionScores({ enabled: false, scope: baseScope, load })

    expect(load).toHaveBeenCalledTimes(3)
  })

  it('removes failed loads so the next request can retry', async () => {
    const load = vi
      .fn<() => Promise<Map<number, RetentionModelScore>>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(new Map([[7, score]]))

    await expect(
      getCachedRetentionScores({ enabled: true, scope: baseScope, load, nowMs: 1_000 }),
    ).rejects.toThrow('temporary failure')
    await expect(
      getCachedRetentionScores({ enabled: true, scope: baseScope, load, nowMs: 1_001 }),
    ).resolves.toEqual(new Map([[7, score]]))

    expect(load).toHaveBeenCalledTimes(2)
  })
})

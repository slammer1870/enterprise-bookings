import type { RetentionModelScore } from './retentionModel'

export const RETENTION_SCORE_CACHE_TTL_MS = 5 * 60_000
const RETENTION_SCORE_CACHE_MAX_ENTRIES = 50

export type RetentionScoreCacheScope = {
  tenantId?: number | null
  branchId?: number | null
  predictionYmd: string
  modelVersion: string
}

type RetentionScoreCacheEntry = {
  expiresAtMs: number
  value: Promise<Map<number, RetentionModelScore>>
}

const retentionScoreCache = new Map<string, RetentionScoreCacheEntry>()

function retentionScoreCacheKey(scope: RetentionScoreCacheScope): string {
  return JSON.stringify([
    scope.tenantId ?? null,
    scope.branchId ?? null,
    scope.predictionYmd,
    scope.modelVersion,
  ])
}

function removeExpiredEntries(nowMs: number): void {
  for (const [key, entry] of retentionScoreCache) {
    if (entry.expiresAtMs <= nowMs) retentionScoreCache.delete(key)
  }
}

export function getCachedRetentionScores(opts: {
  enabled: boolean
  scope: RetentionScoreCacheScope
  load: () => Promise<Map<number, RetentionModelScore>>
  nowMs?: number
}): Promise<Map<number, RetentionModelScore>> {
  if (!opts.enabled) return opts.load()

  const nowMs = opts.nowMs ?? Date.now()
  const key = retentionScoreCacheKey(opts.scope)
  const cached = retentionScoreCache.get(key)
  if (cached && cached.expiresAtMs > nowMs) {
    // Refresh insertion order so the size bound behaves as a small LRU cache.
    retentionScoreCache.delete(key)
    retentionScoreCache.set(key, cached)
    return cached.value
  }
  if (cached) retentionScoreCache.delete(key)

  removeExpiredEntries(nowMs)
  while (retentionScoreCache.size >= RETENTION_SCORE_CACHE_MAX_ENTRIES) {
    const oldestKey = retentionScoreCache.keys().next().value
    if (typeof oldestKey !== 'string') break
    retentionScoreCache.delete(oldestKey)
  }

  const value = Promise.resolve().then(opts.load)
  const entry = { expiresAtMs: nowMs + RETENTION_SCORE_CACHE_TTL_MS, value }
  retentionScoreCache.set(key, entry)

  void value.catch(() => {
    // Never retain a rejected promise: the next request should be allowed to retry.
    if (retentionScoreCache.get(key) === entry) retentionScoreCache.delete(key)
  })

  return value
}

export function resetRetentionScoreCacheForTests(): void {
  retentionScoreCache.clear()
}

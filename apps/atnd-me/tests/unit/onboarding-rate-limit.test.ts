import { describe, expect, it, beforeEach } from 'vitest'

import { checkRateLimit, resetRateLimitBuckets } from '@/lib/onboarding/rateLimit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimitBuckets()
  })

  it('allows requests under the limit', () => {
    expect(checkRateLimit({ key: 't1', limit: 2, windowMs: 60_000 }).allowed).toBe(true)
    expect(checkRateLimit({ key: 't1', limit: 2, windowMs: 60_000 }).allowed).toBe(true)
  })

  it('blocks once the limit is reached', () => {
    checkRateLimit({ key: 't2', limit: 1, windowMs: 60_000 })
    const blocked = checkRateLimit({ key: 't2', limit: 1, windowMs: 60_000 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it('isolates keys', () => {
    checkRateLimit({ key: 'a', limit: 1, windowMs: 60_000 })
    expect(checkRateLimit({ key: 'b', limit: 1, windowMs: 60_000 }).allowed).toBe(true)
  })
})

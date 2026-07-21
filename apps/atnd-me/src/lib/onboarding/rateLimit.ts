type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Simple in-memory sliding-window rate limiter for public onboarding endpoints.
 * Suitable for single-instance deploys; replace with Redis if horizontally scaled.
 */
export function checkRateLimit(opts: {
  key: string
  limit: number
  windowMs: number
}): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const existing = buckets.get(opts.key)

  if (!existing || existing.resetAt <= now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (existing.count >= opts.limit) {
    return { allowed: false, retryAfterMs: Math.max(0, existing.resetAt - now) }
  }

  existing.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

/** Test helper to clear buckets between cases. */
export function resetRateLimitBuckets(): void {
  buckets.clear()
}

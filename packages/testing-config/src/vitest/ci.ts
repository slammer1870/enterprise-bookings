/**
 * Shared CI helpers for Vitest and Playwright sharding.
 */

export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.CI === '1'
}

/** Vitest shard from VITEST_SHARD env (e.g. "3/8"). Returns undefined when unset. */
export function getVitestShard(): string | undefined {
  const shard = process.env.VITEST_SHARD?.trim()
  return shard || undefined
}

/** Playwright shard from PLAYWRIGHT_SHARD env (e.g. "2/4"). Returns undefined when unset. */
export function getPlaywrightShard(): string | undefined {
  const shard = process.env.PLAYWRIGHT_SHARD?.trim()
  return shard || undefined
}

/** Default Vitest shard CLI args for package scripts (falls back to 1/1). */
export function getVitestShardArg(): string {
  return getVitestShard() ?? '1/1'
}

/** Default Playwright shard CLI args for package scripts (falls back to 1/1). */
export function getPlaywrightShardArg(): string {
  return getPlaywrightShard() ?? '1/1'
}

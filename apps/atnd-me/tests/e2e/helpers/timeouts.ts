/** Opt-in shorter e2e timeouts for local iteration. Set PW_E2E_FAST=1 (see test:e2e:fast). */
export const isE2EFast = ['1', 'true', 'yes'].includes(
  (process.env.PW_E2E_FAST ?? '').toLowerCase(),
)

/** Stop the run after the first failure. Set PW_E2E_BAIL=1 (enabled by test:e2e:fast). */
export const isE2EBail = ['1', 'true', 'yes'].includes(
  (process.env.PW_E2E_BAIL ?? '').toLowerCase(),
)

/**
 * Playwright maxFailures threshold (see playwright.config.ts).
 * Local default is 5; override with PW_E2E_MAX_FAILURES, or PW_E2E_BAIL=1 for 1.
 */
export const e2eMaxFailuresEnv = process.env.PW_E2E_MAX_FAILURES

/** Scale a test/describe timeout down in fast mode (floor 25s). */
export function e2eTestTimeout(normalMs: number): number {
  if (!isE2EFast) return normalMs
  return Math.max(25_000, Math.round(normalMs * 0.45))
}

/** Scale a per-expect timeout down in fast mode (floor 3s). */
export function e2eExpectTimeout(normalMs: number): number {
  if (!isE2EFast) return normalMs
  return Math.max(3_000, Math.round(normalMs * 0.4))
}

/** Default expect timeout for assertions without an explicit timeout. */
export const defaultExpectTimeoutMs = isE2EFast ? 8_000 : 15_000

/** Multi-step flows: generous in CI, tighter locally; scales down with PW_E2E_FAST. */
export function e2eSlowTestTimeout(ciMs = 120_000, localMs = 60_000): number {
  return e2eTestTimeout(process.env.CI ? ciMs : localMs)
}

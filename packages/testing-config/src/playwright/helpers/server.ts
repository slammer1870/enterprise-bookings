import type { APIRequestContext } from '@playwright/test'

/**
 * Wait for a server to respond by polling a health endpoint.
 * Useful in CI where dev builds can make the first request slow.
 */
export async function waitForServerReady(
  request: APIRequestContext,
  {
    path = '/api/health',
    attempts = 12,
    delayMs = 2500,
    timeoutMs = 5000,
  }: { path?: string; attempts?: number; delayMs?: number; timeoutMs?: number } = {},
) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await request.get(path, { timeout: timeoutMs })
      if (res.ok()) return
    } catch {
      // ignore and retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error(`Server health check did not respond in time (${path})`)
}





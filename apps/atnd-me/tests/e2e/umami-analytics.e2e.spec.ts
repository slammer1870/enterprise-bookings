import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

const UMAMI_SCRIPT_URL = process.env.UMAMI_SCRIPT_URL ?? ''
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? ''
const UMAMI_DOMAINS = process.env.UMAMI_DOMAINS ?? ''
const E2E_PORT = process.env.E2E_PORT?.trim() || '3000'
const APP_ORIGIN = `http://127.0.0.1:${E2E_PORT}`
const CONFIGURED_HOSTNAME = 'localhost'
const analyticsConfigured = Boolean(UMAMI_SCRIPT_URL && UMAMI_WEBSITE_ID && UMAMI_DOMAINS)

async function getPageHTMLForHost(request: APIRequestContext, host: string) {
  const response = await request.get(`${APP_ORIGIN}/`, {
    headers: { Host: host },
  })

  return {
    html: await response.text(),
    status: response.status(),
  }
}

test.describe('Umami analytics', () => {
  test.skip(!analyticsConfigured, 'requires explicit Umami preflight environment variables')

  test('emits the loader only for an explicitly configured hostname', async ({ request }) => {
    const configuredHost = await getPageHTMLForHost(request, CONFIGURED_HOSTNAME)
    const unconfiguredHost = await getPageHTMLForHost(request, `tenant-a.invalid:${E2E_PORT}`)

    expect(configuredHost.status).toBe(200)
    expect(configuredHost.html).toContain(UMAMI_SCRIPT_URL)
    expect(configuredHost.html).toContain('umami-before-send')
    // Next may serialize next/script props into the streamed React payload rather than
    // emitting a literal script tag in the initial HTML response.
    expect(configuredHost.html).toContain('data-before-send')
    expect(configuredHost.html).toContain('data-domains')
    expect(configuredHost.html).toContain(CONFIGURED_HOSTNAME)
    expect(configuredHost.html).toContain(UMAMI_WEBSITE_ID)

    expect(unconfiguredHost.html).not.toContain(UMAMI_SCRIPT_URL)
    expect(unconfiguredHost.html).not.toContain(UMAMI_WEBSITE_ID)
  })
})

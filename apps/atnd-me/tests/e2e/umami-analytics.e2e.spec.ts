import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

const UMAMI_SCRIPT_URL = process.env.UMAMI_SCRIPT_URL ?? ''
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID ?? ''
const UMAMI_DOMAINS = process.env.UMAMI_DOMAINS ?? ''
const APP_ORIGIN = 'http://127.0.0.1:3000'
const CONFIGURED_HOSTNAME = 'localhost'
const analyticsConfigured = Boolean(UMAMI_SCRIPT_URL && UMAMI_WEBSITE_ID && UMAMI_DOMAINS)

async function getPageHTMLForHost(request: APIRequestContext, host: string) {
  const response = await request.get(`${APP_ORIGIN}/`, {
    headers: { Host: host },
  })
  expect(response).toBeOK()
  return response.text()
}

test.describe('Umami analytics', () => {
  test.skip(!analyticsConfigured, 'requires explicit Umami preflight environment variables')

  test('emits the loader only for an explicitly configured hostname', async ({ request }) => {
    const configuredHTML = await getPageHTMLForHost(request, CONFIGURED_HOSTNAME)
    const unconfiguredHost = await getPageHTMLForHost(request, 'tenant-a.invalid:3000')

    expect(configuredHTML).toContain(UMAMI_SCRIPT_URL)
    expect(configuredHTML).toContain('umami-before-send')
    // Next may serialize next/script props into the streamed React payload rather than
    // emitting a literal script tag in the initial HTML response.
    expect(configuredHTML).toContain('data-before-send')
    expect(configuredHTML).toContain('data-domains')
    expect(configuredHTML).toContain(CONFIGURED_HOSTNAME)
    expect(configuredHTML).toContain(UMAMI_WEBSITE_ID)

    expect(unconfiguredHost).not.toContain(UMAMI_SCRIPT_URL)
    expect(unconfiguredHost).not.toContain(UMAMI_WEBSITE_ID)
  })
})

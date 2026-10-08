/**
 * E2E: a named canonical host serves the page and publishes the indexed URL.
 *
 * Uses *.127.0.0.1.nip.io so DNS resolves to loopback while Host is not *.localhost,
 * the same shape as the apex-domain redirect end-to-end test.
 *
 * Requires outbound DNS (nip.io). Skip when unavailable.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- serve-canonical-host
 */
import type { Page, Response } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant } from './helpers/data-helpers'
import { enableApexRedirect } from './helpers/apex-redirect'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

async function expectServedIndexedUrl(
  page: Page,
  response: Response | null,
  host: string,
  pathname: string,
) {
  expect(response?.status()).toBe(200)
  const finalUrl = new URL(page.url())
  expect(finalUrl.hostname).toBe(host)
  expect(finalUrl.pathname).toBe(pathname)

  const indexedUrl = `https://${host}${pathname}`
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexedUrl)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexedUrl)
}

test.describe('Serve the named canonical host (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test('an apex canonical host serves the requested path and publishes the indexed URL', async ({
    page,
    testData,
  }) => {
    // PW_E2E_FAST caps navigation at 20s. The first /[slug] compile can take longer.
    test.setTimeout(90_000)
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const canonicalHost = `e2e-canon-${w}-${stamp}.127.0.0.1.nip.io`
    const tenantName = `E2E Canonical ${w} ${stamp}`
    const slug = `canon-${w}-${stamp}`

    const tenant = await createTestTenant(tenantName, slug, canonicalHost)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const response = await page.goto(`http://${canonicalHost}:${port}/kids?ref=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expectServedIndexedUrl(page, response, canonicalHost, '/kids')
    await expect(page).toHaveTitle(tenantName)

    const search = await page.goto(`http://${canonicalHost}:${port}/search?ref=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expectServedIndexedUrl(page, search, canonicalHost, '/search')
  })

  test('with no canonical host named, the platform subdomain serves and publishes its indexed URL', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `plat-${w}-${stamp}`
    const tenantName = `E2E Platform ${w} ${stamp}`
    const platformHost = `${slug}.localhost`

    const tenant = await createTestTenant(tenantName, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const response = await page.goto(`http://${platformHost}:${port}/kids?ref=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await expectServedIndexedUrl(page, response, platformHost, '/kids')
  })

  test('an existing custom domain with apex redirect still serves www and redirects the apex', async ({
    page,
    testData,
  }) => {
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const apexHost = `e2e-legacy-${w}-${stamp}.127.0.0.1.nip.io`
    const wwwHost = `www.${apexHost}`
    const slug = `legacy-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Legacy ${w} ${stamp}`, slug, wwwHost)
    await createTestPage(tenant.id, 'kids', 'Kids')
    await enableApexRedirect(slug, apexHost)

    // Next dev aborts the middleware host lookup after 2s. Compile that route first
    // so the lookup returns before the deadline. Production e2e has no deadline.
    await page.request.get(
      `http://localhost:${port}/api/tenant-by-host?host=${encodeURIComponent(apexHost)}`,
      {
        headers: { 'x-resolve-host': apexHost },
        timeout: 60_000,
      },
    )

    const redirect = await page.request.get(`http://${apexHost}:${port}/kids?ref=1`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(redirect.status()).toBe(301)
    expect(redirect.headers()['location']).toBe(`http://${wwwHost}:${port}/kids?ref=1`)

    const response = await page.goto(`http://${wwwHost}:${port}/kids?ref=1`, {
      waitUntil: 'domcontentloaded',
    })
    await expectServedIndexedUrl(page, response, wwwHost, '/kids')
  })
})

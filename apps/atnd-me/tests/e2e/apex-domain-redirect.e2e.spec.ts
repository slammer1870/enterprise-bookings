/**
 * E2E: a derived apex is not a redirect to the stored www hostname.
 *
 * The stored custom domain still serves. The derived apex is not an alias host,
 * so a request there is not a 301 to www.
 *
 * Uses *.127.0.0.1.nip.io so DNS resolves to loopback while Host is not *.localhost.
 *
 * Requires outbound DNS (nip.io). Skip when unavailable.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- apex-domain-redirect
 */
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { enableApexRedirect } from './helpers/apex-redirect'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { releaseClaimedApex } from './helpers/release-claimed-apex'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import type { Tenant } from '@repo/shared-types'

const port = process.env.E2E_PORT?.trim() || '3000'

/** Next dev aborts the middleware host lookup after 2s. Compile that route first. */
async function warmApexLookup(page: Page, origin: string) {
  const apexHost = new URL(origin).hostname
  await page.request.get(
    `http://localhost:${port}/api/tenant-by-host?host=${encodeURIComponent(apexHost)}`,
    {
      headers: { 'x-resolve-host': apexHost },
      timeout: 60_000,
    },
  )
}

test.describe('Apex domain redirect (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  let wwwOrigin: string
  let apexOrigin: string
  let nipIoAvailable = false

  test.beforeAll(async ({ testData }) => {
    nipIoAvailable = await isNipIoDnsAvailable()
    if (!nipIoAvailable) return

    const w = testData.workerIndex
    const stamp = Date.now()

    await releaseClaimedApex('nip.io')

    const apexHost = `e2e-apex-${w}-${stamp}.127.0.0.1.nip.io`
    const wwwHost = `www.${apexHost}`

    wwwOrigin = `http://${wwwHost}:${port}`
    apexOrigin = `http://${apexHost}:${port}`

    // The stored www hostname serves. The apex is not in the hostname list, so it
    // must not 301 to www.
    const slug = `apex-cd-${w}-${stamp}`
    await createTestTenant(`E2E apex redirect ${w} ${stamp}`, slug, wwwHost)
    await enableApexRedirect(slug, apexHost)
  })

  test('a derived apex does not redirect to the stored www host', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')
    test.setTimeout(90_000)

    await warmApexLookup(page, apexOrigin)
    const response = await page.request.get(`${apexOrigin}/`, { maxRedirects: 0, timeout: 60_000 })
    expect(response.status()).not.toBe(301)
    expect(response.headers()['location'] ?? '').not.toContain('www.')
  })

  test('a derived apex does not redirect a deeper path to the stored www host', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const response = await page.request.get(`${apexOrigin}/home`, { maxRedirects: 0, timeout: 60_000 })
    expect(response.status()).not.toBe(301)
    expect(response.headers()['location'] ?? '').not.toContain('www.')
  })

  test('www domain is served normally without further redirect', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const response = await page.goto(`${wwwOrigin}/`, { waitUntil: 'domcontentloaded' })
    const url = new URL(page.url())

    // Should stay on the www host (no redirect loop)
    expect(url.host).toMatch(/^www\./)
    // Allow 4xx: the tenant has no pages configured; we only care that no redirect occurred.
    expect(response?.status()).toBeLessThan(500)
  })

  test('a lone hostname serves and does not redirect', async ({ testData, page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    await releaseClaimedApex('nip.io')
    const plainHost = `e2e-noapex-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `noapex-cd-${w}-${stamp}`

    // Create a tenant whose only public host is this hostname.
    const payload = await getPayloadInstance()
    await payload.create({
      collection: 'tenants',
      data: {
        name: `E2E no-apex ${w}`,
        slug,
        hostnames: [plainHost],
        direction: 'allow-www-and-non-www',
      },
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0]) as Tenant

    // Visiting the domain directly should not redirect (even if the page 404s because no
    // pages are configured for this freshly-created tenant).
    await page.goto(`http://${plainHost}:${port}/`, { waitUntil: 'commit' })
    const url = new URL(page.url())
    expect(url.hostname).toBe(plainHost)
  })
})

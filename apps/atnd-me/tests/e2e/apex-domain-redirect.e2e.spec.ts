/**
 * E2E: apex domain redirects to the www custom domain.
 *
 * Uses *.127.0.0.1.nip.io so DNS resolves to loopback while Host is not *.localhost,
 * exercising the same middleware tenant-by-host path as production custom domains.
 *
 * Domain layout:
 *   www.e2e-apex-{w}-{stamp}.127.0.0.1.nip.io  →  tenant.domain  (served normally)
 *   e2e-apex-{w}-{stamp}.127.0.0.1.nip.io       →  apex_domain   (301 redirect to www)
 *
 * Requires outbound DNS (nip.io). Skip when unavailable.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- apex-domain-redirect
 */
import { test, expect } from './helpers/fixtures'
import { createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'
import type { Tenant } from '@repo/shared-types'

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

    const apexHost = `e2e-apex-${w}-${stamp}.127.0.0.1.nip.io`
    const wwwHost = `www.${apexHost}`

    wwwOrigin = `http://${wwwHost}:3000`
    apexOrigin = `http://${apexHost}:3000`

    const payload = await getPayloadInstance()

    // Create tenant with the www.* domain and redirectApex enabled.
    // The afterChange hook will write apexDomain = apexHost so the middleware
    // can resolve it. We bypass the Cloudflare/Stripe hooks via overrideAccess
    // but those are mocked in integration; here we use the real hooks but they
    // will simply log warnings if CLOUDFLARE_API_TOKEN is not set in the e2e env.
    const slug = `apex-cd-${w}-${stamp}`
    await createTestTenant(`E2E apex redirect ${w}`, slug, wwwHost)

    // Enable redirectApex via direct Payload update (createTestTenant doesn't support it)
    await payload.update({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      data: { redirectApex: true },
      overrideAccess: true,
    })
  })

  test('apex domain issues a 301 redirect to the www host', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    await page.goto(`${apexOrigin}/`, { waitUntil: 'commit' })

    // Playwright follows redirects by default; the final URL must be the www host
    // (proving the apex redirect fired).  page.goto() returns the final navigation
    // response so we cannot assert on the 301 status code directly — the URL check
    // is the canonical proof that the redirect happened.
    const finalUrl = new URL(page.url())
    expect(finalUrl.host).toMatch(/^www\./)
  })

  test('apex redirect preserves the path', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    await page.goto(`${apexOrigin}/home`, { waitUntil: 'domcontentloaded' })
    const url = new URL(page.url())
    expect(url.host).toMatch(/^www\./)
    expect(url.pathname).toBe('/home')
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

  test('tenant without redirectApex does not redirect its apex', async ({ testData, page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const plainHost = `e2e-noapex-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `noapex-cd-${w}-${stamp}`

    // Create a tenant with a non-www domain and no redirectApex
    const payload = await getPayloadInstance()
    await payload.create({
      collection: 'tenants',
      data: { name: `E2E no-apex ${w}`, slug, domain: plainHost },
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0]) as Tenant

    // Visiting the domain directly should not redirect (even if the page 404s because no
    // pages are configured for this freshly-created tenant).
    await page.goto(`http://${plainHost}:3000/`, { waitUntil: 'commit' })
    const url = new URL(page.url())
    expect(url.hostname).toBe(plainHost)
  })
})

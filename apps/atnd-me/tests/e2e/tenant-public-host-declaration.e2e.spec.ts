/**
 * E2E: tenant public host declaration rules at the HTTP seam.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- tenant-public-host-declaration
 */
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { releaseClaimedApex } from './helpers/release-claimed-apex'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

test.describe('Tenant public host declaration (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test('a hostname on a claimed apex that was not declared is an unknown host', async ({
    testData,
    page,
  }) => {
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    await releaseClaimedApex('nip.io')
    const base = `e2e-decl-${w}-${stamp}.127.0.0.1.nip.io`
    const canonicalHost = `shop.blog.${base}`
    const undeclaredHost = `other.blog.${base}`
    const slug = `decl-${w}-${stamp}`

    await createTestTenant(`E2E Decl ${w} ${stamp}`, slug, canonicalHost)

    const response = await page.request.get(`http://${undeclaredHost}:${port}/`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(response.status()).toBe(404)
    const body = await response.text()
    expect(body).toContain('<title>Not found</title>')
  })

  test('replacing the hostname list drops the previous hostname, and keeping it in the list makes it serve', async ({
    testData,
    page,
  }) => {
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    await releaseClaimedApex('nip.io')
    const oldCanonical = `e2e-decl-old-${w}-${stamp}.127.0.0.1.nip.io`
    const newCanonical = `e2e-decl-new-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `decl-rep-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Decl Replace ${w} ${stamp}`, slug, oldCanonical)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const payload = await getPayloadInstance()

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [newCanonical], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    const unknown = await page.request.get(`http://${oldCanonical}:${port}/kids`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(unknown.status()).toBe(404)

    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        hostnames: [newCanonical, oldCanonical],
        direction: 'allow-www-and-non-www',
      },
      overrideAccess: true,
    })

    const served = await page.request.get(`http://${oldCanonical}:${port}/kids?ref=1`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(served.status()).toBe(200)
    expect(served.headers()['location'] ?? '').toBe('')
  })

  test('a hostname on another apex serves when it is in the list', async ({ testData, page }) => {
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    await releaseClaimedApex('nip.io')
    const canonicalHost = `e2e-decl-xa-${w}-${stamp}.127.0.0.1.nip.io`
    const otherApexHost = `e2e-decl-xa-other-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `decl-xa-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Decl Cross Apex ${w} ${stamp}`, slug, canonicalHost)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        hostnames: [canonicalHost, otherApexHost],
        direction: 'allow-www-and-non-www',
      },
      overrideAccess: true,
    })

    const served = await page.request.get(`http://${otherApexHost}:${port}/kids?ref=1`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(served.status()).toBe(200)
    expect(served.headers()['location'] ?? '').toBe('')
  })

  test('refuses saving a hostname another tenant already uses', async ({ testData }) => {
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    await releaseClaimedApex('nip.io')
    const host = `e2e-decl-conflict-${w}-${stamp}.127.0.0.1.nip.io`
    const slug1 = `decl-c1-${w}-${stamp}`
    const slug2 = `decl-c2-${w}-${stamp}`

    await createTestTenant(`E2E Decl Conflict A ${w} ${stamp}`, slug1, host)
    const tenantB = await createTestTenant(`E2E Decl Conflict B ${w} ${stamp}`, slug2)

    const payload = await getPayloadInstance()
    await expect(
      payload.update({
        collection: 'tenants',
        id: tenantB.id,
        data: { hostnames: [host] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already uses/i)
  })
})

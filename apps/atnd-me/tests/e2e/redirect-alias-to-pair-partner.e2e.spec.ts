/**
 * E2E: an alias host 301s to the other hostname in its www/apex pair.
 * The platform subdomain 301s to the canonical host once any custom hostname is named.
 *
 * The public host is `x-forwarded-host`. The connection is loopback so the
 * hostname can be a real registrable domain. The request observes the 301
 * from the origin. Following it and checking only the final page would hide
 * the alias response.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- redirect-alias-to-pair-partner
 */
import type { APIResponse, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

/** Next dev aborts the middleware host lookup after 2s. Compile that route first. */
async function warmHostLookup(page: Page, host: string) {
  await page.request.get(
    `http://127.0.0.1:${port}/api/tenant-by-host?host=${encodeURIComponent(host)}`,
    {
      headers: { 'x-resolve-host': host },
      timeout: 60_000,
    },
  )
}

async function warmSlugLookup(page: Page, slug: string) {
  await page.request.get(`http://127.0.0.1:${port}/api/tenant-by-slug?slug=${encodeURIComponent(slug)}`, {
    timeout: 60_000,
  })
}

/** The origin answers this request. maxRedirects: 0 keeps the 301 from being followed. */
async function requestPublic(page: Page, host: string, pathAndQuery: string): Promise<APIResponse> {
  return page.request.get(`http://127.0.0.1:${port}${pathAndQuery}`, {
    headers: { 'x-forwarded-host': host },
    maxRedirects: 0,
    timeout: 60_000,
  })
}

function expectOriginRedirect(response: APIResponse, target: string) {
  expect(new URL(response.url()).hostname).toBe('127.0.0.1')
  expect(response.status()).toBe(301)
  const location = response.headers()['location']
  expect(location).toBe(target)
  const url = new URL(location ?? 'http://invalid')
  expect(url.protocol).toBe('https:')
  expect(url.port).toBe('')
}

test.describe('Redirect each alias host to its pair partner (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test('redirect to www sends the apex to www, keeps path and query, and is not the page', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-to-www-${w}-${stamp}.com`
    const www = `www.${apex}`
    const slug = `towww-${w}-${stamp}`
    const tenantName = `E2E To Www ${w} ${stamp}`

    const tenant = await createTestTenant(tenantName, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www, apex], direction: 'redirect-to-www' },
      overrideAccess: true,
    })

    await warmHostLookup(page, apex)

    const redirect = await requestPublic(page, apex, '/kids?ref=1')
    expectOriginRedirect(redirect, `https://${www}/kids?ref=1`)
    const body = await redirect.text()
    expect(body).not.toContain(tenantName)
    expect(body).not.toContain('Kids')
  })

  test('redirect to non-www sends www to the apex', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-to-apex-${w}-${stamp}.com`
    const www = `www.${apex}`
    const slug = `toapex-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E To Apex ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www, apex], direction: 'redirect-to-non-www' },
      overrideAccess: true,
    })

    await warmHostLookup(page, www)

    const redirect = await requestPublic(page, www, '/kids?ref=1')
    expectOriginRedirect(redirect, `https://${apex}/kids?ref=1`)
  })

  test('that redirect applies to the page, robots, and every sitemap path', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-paths-${w}-${stamp}.com`
    const www = `www.${apex}`
    const slug = `paths-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Paths ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www, apex], direction: 'redirect-to-non-www' },
      overrideAccess: true,
    })

    await warmHostLookup(page, www)

    const paths = ['/', '/kids', '/robots.txt', '/sitemap.xml', '/pages-sitemap.xml', '/posts-sitemap.xml']
    for (const path of paths) {
      const redirect = await requestPublic(page, www, `${path}?ref=1`)
      expectOriginRedirect(redirect, `https://${apex}${path}?ref=1`)
    }
  })

  test('an alias sitemap follows its pair, then the canonical host', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-chain-${w}-${stamp}.com`
    const www = `www.${apex}`
    const other = `e2e-chain-other-${w}-${stamp}.com`
    const otherWww = `www.${other}`
    const slug = `chain-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Chain ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        hostnames: [www, apex, otherWww, other],
        direction: 'redirect-to-non-www',
      },
      overrideAccess: true,
    })

    await warmHostLookup(page, otherWww)
    await warmHostLookup(page, other)

    const toPartner = await requestPublic(page, otherWww, '/sitemap.xml')
    expectOriginRedirect(toPartner, `https://${other}/sitemap.xml`)

    const toCanonical = await requestPublic(page, other, '/sitemap.xml')
    expectOriginRedirect(toCanonical, `https://${apex}/sitemap.xml`)
  })

  test('an alias pages sitemap follows its pair, and that host returns 404', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-pages-${w}-${stamp}.com`
    const www = `www.${apex}`
    const other = `e2e-pages-other-${w}-${stamp}.com`
    const otherWww = `www.${other}`
    const slug = `pages-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Pages ${w} ${stamp}`, slug)
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        hostnames: [www, apex, otherWww, other],
        direction: 'redirect-to-non-www',
      },
      overrideAccess: true,
    })

    await warmHostLookup(page, otherWww)
    await warmHostLookup(page, other)

    const toPartner = await requestPublic(page, otherWww, '/pages-sitemap.xml')
    expectOriginRedirect(toPartner, `https://${other}/pages-sitemap.xml`)

    const missing = await requestPublic(page, other, '/pages-sitemap.xml')
    expect(missing.status()).toBe(404)
  })

  test('the other apex serves and names the canonical host', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-other-${w}-${stamp}.com`
    const www = `www.${apex}`
    const other = `e2e-other-b-${w}-${stamp}.com`
    const otherWww = `www.${other}`
    const slug = `other-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Other ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        hostnames: [www, apex, otherWww, other],
        direction: 'redirect-to-non-www',
      },
      overrideAccess: true,
    })

    await warmHostLookup(page, other)

    const response = await requestPublic(page, other, '/kids?ref=1')
    expect(response.status()).toBe(200)

    await page.setExtraHTTPHeaders({ 'x-forwarded-host': other })
    const opened = await page.goto(`http://127.0.0.1:${port}/kids?ref=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    expect(opened?.status()).toBe(200)
    const indexed = `https://${apex}/kids`
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexed)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexed)
  })

  test('www without its apex serves, and the missing hostname is not invented', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-lone-www-${w}-${stamp}.com`
    const www = `www.${apex}`
    const slug = `lonewww-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Lone Www ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www], direction: 'redirect-to-www' },
      overrideAccess: true,
    })

    await warmHostLookup(page, www)
    await warmHostLookup(page, apex)

    const served = await requestPublic(page, www, '/kids?ref=1')
    expect(served.status()).toBe(200)

    const invented = await requestPublic(page, apex, '/kids?ref=1')
    expect(invented.status()).toBe(404)
    expect(invented.headers()['location']).toBeFalsy()
    expect(await invented.text()).toContain('Not found')
  })

  test('the platform subdomain redirects to the canonical host once a custom hostname is named', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-platform-${w}-${stamp}.com`
    const www = `www.${apex}`
    const slug = `plat-${w}-${stamp}`
    const platformHost = `${slug}.localhost`

    const tenant = await createTestTenant(`E2E Platform ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www, apex], direction: 'redirect-to-non-www' },
      overrideAccess: true,
    })

    await warmSlugLookup(page, slug)

    const redirect = await requestPublic(page, platformHost, '/kids?ref=1')
    expectOriginRedirect(redirect, `https://${apex}/kids?ref=1`)
    const body = await redirect.text()
    expect(body).not.toContain('Kids')
  })

  test('with no custom hostname the platform subdomain serves and does not redirect', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `emptyplat-${w}-${stamp}`
    const tenantName = `E2E Empty Plat ${w} ${stamp}`
    const platformHost = `${slug}.localhost`

    const tenant = await createTestTenant(tenantName, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    await warmSlugLookup(page, slug)

    const response = await requestPublic(page, platformHost, '/kids?ref=1')
    expect(response.status()).toBe(200)
    expect(response.headers()['location']).toBeFalsy()
    expect(await response.text()).toContain(tenantName)
  })
})

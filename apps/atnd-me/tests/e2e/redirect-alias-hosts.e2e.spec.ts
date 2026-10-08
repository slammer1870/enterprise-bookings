/**
 * E2E: once a canonical host is named, every alias host 301s to it.
 *
 * Uses *.127.0.0.1.nip.io so DNS resolves to loopback while Host is not *.localhost,
 * the same shape as the apex-domain redirect end-to-end test.
 *
 * The request observes the 301. Following it and checking only the final page would hide
 * the alias response.
 *
 * Requires outbound DNS (nip.io) for custom hosts. Skip those when unavailable.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- redirect-alias-hosts
 */
import type { APIResponse } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

async function expectAliasRedirect(
  response: APIResponse,
  canonicalHost: string,
  pathAndQuery: string,
) {
  expect(response.status()).toBe(301)
  const queryIndex = pathAndQuery.indexOf('?')
  const pathname = queryIndex === -1 ? pathAndQuery : pathAndQuery.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : pathAndQuery.slice(queryIndex)
  expect(response.headers()['location']).toBe(`https://${canonicalHost}${pathname}${query}`)
}

test.describe('Redirect alias hosts to the canonical host (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  let nipIoAvailable = false
  let canonicalHost = ''
  let wwwHost = ''
  let otherApexHost = ''
  let platformHost = ''
  let tenantName = ''

  test.beforeAll(async ({ testData }) => {
    nipIoAvailable = await isNipIoDnsAvailable()
    if (!nipIoAvailable) return

    const w = testData.workerIndex
    const stamp = Date.now()
    canonicalHost = `e2e-alias-${w}-${stamp}.127.0.0.1.nip.io`
    wwwHost = `www.${canonicalHost}`
    otherApexHost = `e2e-alias-other-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `alias-${w}-${stamp}`
    platformHost = `${slug}.localhost`
    tenantName = `E2E Alias ${w} ${stamp}`

    const tenant = await createTestTenant(tenantName, slug, canonicalHost)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { aliasHosts: [wwwHost, otherApexHost] },
      overrideAccess: true,
    })
  })

  test('a www alias returns 301 to the canonical host and does not serve the page', async ({
    page,
  }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    await page.request.get(
      `http://localhost:${port}/api/tenant-by-host?host=${encodeURIComponent(wwwHost)}`,
      {
        headers: { 'x-resolve-host': wwwHost },
        timeout: 60_000,
      },
    )

    const redirect = await page.request.get(`http://${wwwHost}:${port}/kids?ref=1`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    await expectAliasRedirect(redirect, canonicalHost, '/kids?ref=1')
    const body = await redirect.text()
    expect(body).not.toContain(tenantName)
    expect(body).not.toContain('Kids')
  })

  test('the platform subdomain redirects to the canonical host', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    await page.request.get(
      `http://localhost:${port}/api/tenant-by-slug?slug=${encodeURIComponent(platformHost.split('.')[0] ?? '')}`,
      { timeout: 60_000 },
    )

    // *.localhost resolves in the browser. Node's DNS does not, so the 301 is observed
    // on the navigation response rather than via APIRequestContext.
    const [redirect] = await Promise.all([
      page.waitForResponse(
        (res) => res.status() === 301 && res.url().includes(`://${platformHost}:${port}/`),
        { timeout: 60_000 },
      ),
      page.goto(`http://${platformHost}:${port}/kids?ref=1`, { waitUntil: 'commit' }).catch(() => null),
    ])
    expect(redirect.status()).toBe(301)
    expect(redirect.headers()['location']).toBe(`https://${canonicalHost}/kids?ref=1`)
  })

  test('an alias on another apex redirects to the canonical host', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    await page.request.get(
      `http://localhost:${port}/api/tenant-by-host?host=${encodeURIComponent(otherApexHost)}`,
      {
        headers: { 'x-resolve-host': otherApexHost },
        timeout: 60_000,
      },
    )

    const redirect = await page.request.get(`http://${otherApexHost}:${port}/kids?ref=1`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    await expectAliasRedirect(redirect, canonicalHost, '/kids?ref=1')
  })

  test('robots and sitemap paths on an alias redirect to the canonical host', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const paths = ['/robots.txt?ref=1', '/sitemap.xml?ref=1', '/pages-sitemap.xml?ref=1', '/posts-sitemap.xml?ref=1']
    for (const pathAndQuery of paths) {
      const redirect = await page.request.get(`http://${wwwHost}:${port}${pathAndQuery}`, {
        maxRedirects: 0,
        timeout: 60_000,
      })
      await expectAliasRedirect(redirect, canonicalHost, pathAndQuery)
    }
  })

  test('the canonical host returns 404 for the legacy sitemap routes', async ({ page }) => {
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const pagesSitemap = await page.request.get(`http://${canonicalHost}:${port}/pages-sitemap.xml`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(pagesSitemap.status()).toBe(404)

    const postsSitemap = await page.request.get(`http://${canonicalHost}:${port}/posts-sitemap.xml`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(postsSitemap.status()).toBe(404)
  })

  test('with no canonical host named, the platform subdomain serves and does not redirect', async ({
    page,
    testData,
  }) => {
    // PW_E2E_FAST shrinks the describe timeout below the first /[slug] compile.
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `alias-none-${w}-${stamp}`
    const name = `E2E Alias None ${w} ${stamp}`
    const host = `${slug}.localhost`

    const tenant = await createTestTenant(name, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const response = await page.goto(`http://${host}:${port}/kids?ref=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    expect(response?.status()).toBe(200)
    const finalUrl = new URL(page.url())
    expect(finalUrl.hostname).toBe(host)
    expect(finalUrl.pathname).toBe('/kids')
    let prior = response?.request().redirectedFrom() ?? null
    while (prior) {
      expect(new URL(prior.url()).hostname).toBe(host)
      prior = prior.redirectedFrom()
    }
  })
})

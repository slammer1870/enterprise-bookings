/**
 * E2E: a www host in a pair redirects to its apex. A hostname on another apex serves.
 * The platform subdomain redirects to the canonical host.
 *
 * The public host is `x-forwarded-host`. The connection is loopback so the
 * hostname can be a real registrable domain. nip.io is not a public suffix,
 * so it cannot form a www/apex pair or a second apex.
 */
import type { APIResponse, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

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

async function requestPublic(page: Page, host: string, pathAndQuery: string): Promise<APIResponse> {
  return page.request.get(`http://127.0.0.1:${port}${pathAndQuery}`, {
    headers: { 'x-forwarded-host': host },
    maxRedirects: 0,
    timeout: 60_000,
  })
}

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

  let canonicalHost = ''
  let wwwHost = ''
  let otherApexHost = ''
  let platformHost = ''
  let tenantName = ''

  test.beforeAll(async ({ testData }) => {
    const w = testData.workerIndex
    const stamp = Date.now()
    canonicalHost = `e2e-alias-${w}-${stamp}.com`
    wwwHost = `www.${canonicalHost}`
    otherApexHost = `e2e-alias-other-${w}-${stamp}.com`
    const slug = `alias-${w}-${stamp}`
    platformHost = `${slug}.localhost`
    tenantName = `E2E Alias ${w} ${stamp}`

    const tenant = await createTestTenant(tenantName, slug, canonicalHost)
    await createTestPage(tenant.id, 'kids', 'Kids')

    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        hostnames: [canonicalHost, wwwHost, otherApexHost],
        direction: 'redirect-to-non-www',
      },
      overrideAccess: true,
    })
  })

  test('a www alias returns 301 to the canonical host and does not serve the page', async ({
    page,
  }) => {
    await warmHostLookup(page, wwwHost)

    const redirect = await requestPublic(page, wwwHost, '/kids?ref=1')
    await expectAliasRedirect(redirect, canonicalHost, '/kids?ref=1')
    const body = await redirect.text()
    expect(body).not.toContain(tenantName)
    expect(body).not.toContain('Kids')
  })

  test('the platform subdomain redirects to the canonical host', async ({ page }) => {
    await warmSlugLookup(page, platformHost.split('.')[0] ?? '')

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

  test('a hostname on another apex serves and does not redirect to the canonical host', async ({
    page,
  }) => {
    await warmHostLookup(page, otherApexHost)

    const response = await requestPublic(page, otherApexHost, '/kids?ref=1')
    expect(response.status()).toBe(200)
    expect(response.headers()['location'] ?? '').toBe('')
  })

  test('robots and sitemap paths on an alias redirect to the canonical host', async ({ page }) => {
    const paths = ['/robots.txt?ref=1', '/sitemap.xml?ref=1', '/pages-sitemap.xml?ref=1', '/posts-sitemap.xml?ref=1']
    for (const pathAndQuery of paths) {
      const redirect = await requestPublic(page, wwwHost, pathAndQuery)
      await expectAliasRedirect(redirect, canonicalHost, pathAndQuery)
    }
  })

  test('the canonical host returns 404 for the legacy sitemap routes', async ({ page }) => {
    test.setTimeout(90_000)
    // A cold /api/tenant-by-host compile exceeds the dev lookup abort, and middleware
    // then answers 503 before this route can 404.
    await warmHostLookup(page, canonicalHost)
    const pagesSitemap = await requestPublic(page, canonicalHost, '/pages-sitemap.xml')
    expect(pagesSitemap.status()).toBe(404)

    const postsSitemap = await requestPublic(page, canonicalHost, '/posts-sitemap.xml')
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

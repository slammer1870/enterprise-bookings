/**
 * E2E: a saved hostname list serves every host that list marks as serving.
 *
 * The public host is `x-forwarded-host`. The connection is loopback so the
 * hostname can be a real registrable domain: www and the apex are a pair.
 * nip.io is not a public suffix in the hostname parser, so it cannot stand in
 * for example.com.
 *
 * The request observes status, the canonical link, the Open Graph URL,
 * robots.txt, and the sitemap 301.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- serve-declared-hosts
 */
import type { APIResponse, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

const note = {
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'text',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Notes',
            version: 1,
          },
        ],
      },
    ],
  },
}

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '')
}

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

async function requestPublic(page: Page, host: string, pathAndQuery: string): Promise<APIResponse> {
  return page.request.get(`http://127.0.0.1:${port}${pathAndQuery}`, {
    headers: { 'x-forwarded-host': host },
    maxRedirects: 0,
    timeout: 60_000,
  })
}

async function openPublic(page: Page, host: string, pathAndQuery: string) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-host': host })
  return page.goto(`http://127.0.0.1:${port}${pathAndQuery}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  })
}

async function expectNoNoindex(page: Page) {
  const robots = page.locator('meta[name="robots"]')
  const count = await robots.count()
  for (let i = 0; i < count; i++) {
    expect(await robots.nth(i).getAttribute('content')).not.toMatch(/noindex/i)
  }
}

test.describe('Serve hosts the declaration marks as serving (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test('allow www and non-www serves both hosts and names the apex', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-serve-${w}-${stamp}.com`
    const www = `www.${apex}`
    const slug = `serve-${w}-${stamp}`
    const tenantName = `E2E Serve ${w} ${stamp}`
    const description = 'Classes in Dublin'

    const tenant = await createTestTenant(tenantName, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        hostnames: [www, apex],
        direction: 'allow-www-and-non-www',
        description,
      },
      overrideAccess: true,
    })

    await warmHostLookup(page, apex)
    await warmHostLookup(page, www)

    for (const host of [apex, www]) {
      for (const path of ['/', '/kids']) {
        const response = await requestPublic(page, host, path)
        expect(response.status()).toBe(200)
        expect(await response.text()).not.toMatch(/noindex/i)
      }
    }

    const kids = await openPublic(page, www, '/kids?ref=1')
    expect(kids?.status()).toBe(200)
    await expectNoNoindex(page)
    const indexedKids = `https://${apex}/kids`
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexedKids)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexedKids)
    await expect(page).toHaveTitle(tenantName)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description)
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', tenantName)
    await expect(page.locator('link[rel="icon"]')).toHaveCount(0)
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0)

    const home = await openPublic(page, apex, '/')
    expect(home?.status()).toBe(200)
    // Next writes the origin for `/`. A content path keeps its path.
    const indexedHome = `https://${apex}`
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexedHome)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexedHome)
  })

  test('robots and sitemap on a non-canonical serving host name the canonical host', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `e2e-map-${w}-${stamp}.com`
    const www = `www.${apex}`
    const slug = `map-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Map ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.create({
      collection: 'pages',
      data: {
        slug: 'private-notes',
        title: 'Private notes',
        tenant: tenant.id,
        _status: 'draft',
        layout: [{ blockType: 'content', columns: [] }],
      },
      draft: true,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'posts',
      data: {
        title: 'Open mat',
        slug: 'open-mat',
        tenant: tenant.id,
        _status: 'published',
        content: note,
      },
      draft: false,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'posts',
      data: {
        title: 'Secret notes',
        slug: 'secret-notes',
        tenant: tenant.id,
        _status: 'draft',
        content: note,
      },
      draft: true,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [www, apex], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    await warmHostLookup(page, www)
    await warmHostLookup(page, apex)

    const robots = await requestPublic(page, www, '/robots.txt')
    expect(robots.status()).toBe(200)
    const robotsBody = await robots.text()
    expect(robotsBody).toContain('Allow: /')
    expect(robotsBody).toContain('Disallow: /admin/')
    expect(robotsBody).toContain('Disallow: /api/')
    expect(robotsBody).toMatch(new RegExp(`^Sitemap: https://${apex}/sitemap.xml$`, 'm'))

    const sitemapRedirect = await requestPublic(page, www, '/sitemap.xml')
    expect(sitemapRedirect.status()).toBe(301)
    expect(sitemapRedirect.headers()['location']).toBe(`https://${apex}/sitemap.xml`)

    const indexed = (path: string) => `https://${apex}${path}`
    const sitemap = await requestPublic(page, apex, '/sitemap.xml?ref=1')
    expect(sitemap.status()).toBe(200)
    const locs = sitemapLocs(await sitemap.text())
    expect(locs.sort()).toEqual(
      [indexed('/'), indexed('/search'), indexed('/posts'), indexed('/kids'), indexed('/posts/open-mat')].sort(),
    )
    for (const loc of locs) {
      const url = new URL(loc)
      expect(url.protocol).toBe('https:')
      expect(url.hostname).toBe(apex)
      expect(url.port).toBe('')
      expect(url.search).toBe('')
    }

    for (const host of [www, apex]) {
      const pagesSitemap = await requestPublic(page, host, '/pages-sitemap.xml')
      expect(pagesSitemap.status()).toBe(404)
      const postsSitemap = await requestPublic(page, host, '/posts-sitemap.xml')
      expect(postsSitemap.status()).toBe(404)
    }
  })

  test('a lone hostname serves as the canonical host', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const host = `lone-${w}-${stamp}.com`
    const slug = `lone-${w}-${stamp}`
    const tenantName = `E2E Lone ${w} ${stamp}`

    const tenant = await createTestTenant(tenantName, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [host], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    await warmHostLookup(page, host)

    const response = await openPublic(page, host, '/kids?ref=1')
    expect(response?.status()).toBe(200)
    const indexed = `https://${host}/kids`
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexed)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexed)
  })

  test('a hostname outside a pair serves and names the canonical host', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const apex = `pair-${w}-${stamp}.com`
    const outside = `mysite.${apex}`
    const slug = `out-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Outside ${w} ${stamp}`, slug)
    await createTestPage(tenant.id, 'kids', 'Kids')
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { hostnames: [apex, outside], direction: 'allow-www-and-non-www' },
      overrideAccess: true,
    })

    await warmHostLookup(page, outside)

    const response = await requestPublic(page, outside, '/kids?ref=1')
    expect(response.status()).toBe(200)
    const opened = await openPublic(page, outside, '/kids?ref=1')
    expect(opened?.status()).toBe(200)
    const indexed = `https://${apex}/kids`
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexed)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexed)
  })

  test('an empty hostname list serves the platform subdomain', async ({ page, testData }) => {
    test.setTimeout(90_000)
    const w = testData.workerIndex
    const stamp = Date.now()
    const slug = `empty-${w}-${stamp}`
    const tenantName = `E2E Empty ${w} ${stamp}`
    const host = `${slug}.localhost`

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

    await page.setExtraHTTPHeaders({})
    const response = await page.goto(`http://${host}:${port}/kids?ref=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    expect(response?.status()).toBe(200)
    const indexed = `https://${host}/kids`
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', indexed)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', indexed)
    const finalUrl = new URL(page.url())
    expect(finalUrl.hostname).toBe(host)
  })
})

/**
 * E2E: the canonical host publishes sitemap.xml and robots.txt.
 *
 * Uses *.127.0.0.1.nip.io so DNS resolves to loopback while Host is not *.localhost,
 * the same shape as the apex-domain redirect end-to-end test.
 *
 * The request includes a port and a query. Indexed URLs in the response must not.
 *
 * Requires outbound DNS (nip.io). Skip when unavailable.
 *
 * Run from monorepo root:
 *   pnpm test:e2e:atnd-me -- sitemap-and-robots
 */
import { test, expect } from './helpers/fixtures'
import { createTestPage, createTestTenant, getPayloadInstance } from './helpers/data-helpers'
import { isNipIoDnsAvailable } from './helpers/dns-helpers'
import { e2eSlowTestTimeout } from './helpers/timeouts'

const port = process.env.E2E_PORT?.trim() || '3000'

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '')
}

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

test.describe('Publish sitemap and robots on the canonical host (E2E)', () => {
  test.describe.configure({ timeout: e2eSlowTestTimeout() })

  test('sitemap lists published paths as indexed URLs, and robots points at that sitemap', async ({
    page,
    testData,
  }) => {
    test.setTimeout(90_000)
    const nipIoAvailable = await isNipIoDnsAvailable()
    test.skip(!nipIoAvailable, 'nip.io DNS is not available')

    const w = testData.workerIndex
    const stamp = Date.now()
    const canonicalHost = `e2e-sitemap-${w}-${stamp}.127.0.0.1.nip.io`
    const slug = `sitemap-${w}-${stamp}`

    const tenant = await createTestTenant(`E2E Sitemap ${w} ${stamp}`, slug, canonicalHost)
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

    const indexed = (path: string) => `https://${canonicalHost}${path}`

    const sitemap = await page.request.get(
      `http://${canonicalHost}:${port}/sitemap.xml?ref=1`,
      { maxRedirects: 0, timeout: 60_000 },
    )
    expect(sitemap.status()).toBe(200)
    const locs = sitemapLocs(await sitemap.text())
    expect(locs.sort()).toEqual(
      [
        indexed('/'),
        indexed('/search'),
        indexed('/posts'),
        indexed('/kids'),
        indexed('/posts/open-mat'),
      ].sort(),
    )
    for (const loc of locs) {
      const url = new URL(loc)
      expect(url.protocol).toBe('https:')
      expect(url.hostname).toBe(canonicalHost)
      expect(url.port).toBe('')
      expect(url.search).toBe('')
    }

    const robots = await page.request.get(`http://${canonicalHost}:${port}/robots.txt?ref=1`, {
      maxRedirects: 0,
      timeout: 60_000,
    })
    expect(robots.status()).toBe(200)
    const body = await robots.text()
    expect(body).toContain('Allow: /')
    expect(body).toContain('Disallow: /admin/')
    expect(body).toContain('Disallow: /api/')
    expect(body).toMatch(new RegExp(`^Sitemap: https://${canonicalHost}/sitemap.xml$`, 'm'))
  })
})

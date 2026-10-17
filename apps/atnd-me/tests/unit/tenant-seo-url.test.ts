import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTenantContext, getTenantWithBranding } from '../../src/utilities/getTenantContext'
import { getTenantSiteURL } from '../../src/utilities/getURL'
import { indexedSitemapURL, publicMetadataURL } from '../../src/utilities/resolvePublicTenant'

describe('tenant SEO URL resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds indexed sitemap URLs without port or query', () => {
    const headers = new Headers({ host: 'tenant.example:3000' })
    expect(indexedSitemapURL('tenant.example', headers)).toBe('https://tenant.example/sitemap.xml')
    expect(indexedSitemapURL(null, headers)).toBe('https://tenant.example/sitemap.xml')
  })

  it('builds public metadata URLs from the canonical host when known', () => {
    expect(
      publicMetadataURL('/kids', {
        indexedHost: 'bru.ie',
        siteUrl: 'http://bru.ie:3000',
      }),
    ).toBe('https://bru.ie/kids')
  })

  it('prefers a tenant custom domain over the platform subdomain', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    expect(
      getTenantSiteURL({
        slug: 'bru',
        hostnames: ['bru.ie'],
        direction: 'allow-www-and-non-www',
      }),
    ).toBe('https://bru.ie')
  })

  it('uses the canonical host derived from the hostname list and Direction', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    expect(
      getTenantSiteURL({
        slug: 'bru',
        hostnames: ['www.example.com', 'example.com'],
        direction: 'redirect-to-non-www',
      }),
    ).toBe('https://example.com')
  })

  it('uses the platform subdomain when the hostname list names no custom hostname', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    expect(
      getTenantSiteURL({
        slug: 'bru',
        hostnames: [],
        direction: 'allow-www-and-non-www',
      }),
    ).toBe('https://bru.atnd.test')
  })

  it('falls back to the platform subdomain when no custom domain exists', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    expect(getTenantSiteURL({ slug: 'bru' })).toBe('https://bru.atnd.test')
  })

  it('preserves localhost ports for tenant subdomains in development', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3000')

    expect(getTenantSiteURL({ slug: 'bru' }, new Headers({ host: 'localhost:3001' }))).toBe(
      'http://bru.localhost:3001',
    )
  })

  it('resolves tenant context from a custom domain host when middleware cookies are absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    const payload = {
      db: {
        drizzle: {
          execute: vi.fn().mockResolvedValue({
            rows: [
              {
                id: 7,
                slug: 'bru',
                hostnames: ['bru.ie'],
                direction: 'allow-www-and-non-www',
              },
            ],
          }),
        },
      },
      find: vi.fn().mockResolvedValueOnce({
        docs: [
          {
            id: 7,
            slug: 'bru',
            name: 'Bru Grappling',
            hostnames: ['bru.ie'],
            direction: 'allow-www-and-non-www',
          },
        ],
      }),
    }

    const tenant = await getTenantContext(payload as never, {
      headers: new Headers({ host: 'bru.ie' }),
    })

    expect(tenant).toMatchObject({
      id: 7,
      slug: 'bru',
      name: 'Bru Grappling',
      hostnames: ['bru.ie'],
      direction: 'allow-www-and-non-www',
    })
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        where: { id: { equals: 7 } },
      }),
    )
  })

  it('resolves tenant context from payload-tenant in Cookie header when Host is platform apex', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    const payload = {
      find: vi.fn(),
      findByID: vi.fn().mockResolvedValue({
        id: 42,
        slug: 'acme',
        name: 'Acme Studio',
        hostnames: ['www.acme.com'],
        direction: 'allow-www-and-non-www',
      }),
    }

    const tenant = await getTenantContext(payload as never, {
      headers: new Headers({
        host: 'atnd.test',
        cookie: 'payload-tenant=42; tenant-slug=acme',
      }),
    })

    expect(tenant).toMatchObject({
      id: 42,
      slug: 'acme',
    })
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'tenants', id: 42 }),
    )
  })

  it('resolves tenant branding from a platform subdomain host when cookies are absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({
          docs: [
            {
              id: 7,
              slug: 'bru',
              name: 'Bru Grappling',
              hostnames: [],
              direction: 'allow-www-and-non-www',
              description: 'Irish grappling classes',
              logo: { url: '/media/bru.png' },
            },
          ],
        }),
    }

    const tenant = await getTenantWithBranding(payload as never, {
      headers: new Headers({ host: 'bru.atnd.test' }),
    })

    expect(tenant).toMatchObject({
      slug: 'bru',
      name: 'Bru Grappling',
      description: 'Irish grappling classes',
    })
  })
})

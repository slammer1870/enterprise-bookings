import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveTenantForMagicLinkUrl } from '../../src/lib/email/resolveTenantForEmailUrl'
import {
  brandingFromTenantDoc,
  buildTenantEmailHeaderHtml,
  resolveTenantEmailBranding,
  wrapCustomerEmailHtml,
} from '../../src/lib/email/tenant-email-branding'

describe('tenant email branding', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('builds name-only branding when logo is missing', () => {
    expect(brandingFromTenantDoc({ name: 'Brú Grappling', slug: 'bru' })).toEqual({
      name: 'Brú Grappling',
      logoUrl: null,
    })
  })

  it('absolutizes relative logo urls against the tenant site', () => {
    expect(
      brandingFromTenantDoc({
        name: 'Studio',
        slug: 'studio',
        hostnames: ['studio.example.com'],
        direction: 'allow-www-and-non-www',
        logo: { url: '/api/media/file/logo.png' },
      }),
    ).toEqual({
      name: 'Studio',
      // Protocol follows platform env (http in local/unit tests).
      logoUrl: 'http://studio.example.com/api/media/file/logo.png',
    })
  })

  it('absolutizes a relative logo against the canonical host from the hostname list', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')
    const doc = {
      name: 'Studio',
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com'],
      direction: 'redirect-to-non-www',
      logo: { url: '/api/media/file/logo.png' },
    }
    const find = vi.fn(async (args: { where?: { slug?: { equals?: string } } }) => {
      if (args.where?.slug?.equals === 'studio') return { docs: [doc] }
      return { docs: [] }
    })

    const tenant = await resolveTenantForMagicLinkUrl('https://www.example.com/admin/reset/token', {
      find,
      db: {
        drizzle: {
          execute: async () => ({
            rows: [
              {
                id: 1,
                slug: 'studio',
                hostnames: doc.hostnames,
                direction: doc.direction,
              },
            ],
          }),
        },
      },
    })

    expect(tenant?.logoUrl).toBe('https://example.com/api/media/file/logo.png')
  })

  it('absolutizes a relative logo when the link host is the canonical host and not the stored custom domain', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')
    const doc = {
      name: 'Studio',
      slug: 'studio',
      hostnames: ['www.example.com', 'example.com'],
      direction: 'redirect-to-non-www',
      logo: { url: '/api/media/file/logo.png' },
    }
    const find = vi.fn(async (args: { where?: { slug?: { equals?: string }; domain?: { equals?: string } } }) => {
      if (args.where?.slug?.equals === 'studio') return { docs: [doc] }
      return { docs: [] }
    })

    const tenant = await resolveTenantForMagicLinkUrl('https://example.com/admin/reset/token', {
      find,
      db: {
        drizzle: {
          execute: async () => ({
            rows: [
              {
                id: 1,
                slug: 'studio',
                hostnames: doc.hostnames,
                direction: doc.direction,
              },
            ],
          }),
        },
      },
    })

    expect(tenant?.logoUrl).toBe('https://example.com/api/media/file/logo.png')
  })

  it('keeps absolute logo urls as-is', () => {
    expect(
      brandingFromTenantDoc({
        name: 'Studio',
        logo: { url: 'https://cdn.example.com/logo.png' },
      }),
    ).toEqual({
      name: 'Studio',
      logoUrl: 'https://cdn.example.com/logo.png',
    })
  })

  it('escapes name and logo url in the header', () => {
    const html = buildTenantEmailHeaderHtml({
      name: `Bob's <Gym>`,
      logoUrl: 'https://cdn.example.com/a"b.png',
    })
    expect(html).toContain('Bob&#39;s &lt;Gym&gt;')
    expect(html).toContain('https://cdn.example.com/a&quot;b.png')
    expect(html).not.toContain(`Bob's <Gym>`)
  })

  it('wraps body html in the shared card shell with logo', () => {
    const html = wrapCustomerEmailHtml({
      name: 'Studio',
      logoUrl: 'https://cdn.example.com/logo.png',
      bodyHtml: '<p>Hello</p>',
      title: 'Gift voucher',
    })
    expect(html).toContain('<title>Gift voucher</title>')
    expect(html).toContain('src="https://cdn.example.com/logo.png"')
    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('background-color:#f6f9fc')
  })

  it('resolves branding from tenant id via payload', async () => {
    const findByID = vi.fn().mockResolvedValue({
      name: 'Loaded Tenant',
      slug: 'loaded',
      hostnames: [],
      logo: { url: '/api/media/file/t.png' },
    })
    const payload = { findByID } as any

    await expect(resolveTenantEmailBranding(payload, 42)).resolves.toEqual({
      name: 'Loaded Tenant',
      logoUrl: expect.stringContaining('/api/media/file/t.png'),
    })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        id: 42,
        depth: 1,
      }),
    )
  })

  it('falls back when tenant id cannot be loaded', async () => {
    const payload = {
      findByID: vi.fn().mockRejectedValue(new Error('missing')),
    } as any
    await expect(resolveTenantEmailBranding(payload, 99, 'ATND ME')).resolves.toEqual({
      name: 'ATND ME',
      logoUrl: null,
    })
  })
})

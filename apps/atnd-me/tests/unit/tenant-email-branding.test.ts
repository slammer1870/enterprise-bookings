import { describe, expect, it, vi } from 'vitest'

import {
  brandingFromTenantDoc,
  buildTenantEmailHeaderHtml,
  resolveTenantEmailBranding,
  wrapCustomerEmailHtml,
} from '../../src/lib/email/tenant-email-branding'

describe('tenant email branding', () => {
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
        domain: 'studio.example.com',
        logo: { url: '/api/media/file/logo.png' },
      }),
    ).toEqual({
      name: 'Studio',
      // Protocol follows platform env (http in local/unit tests).
      logoUrl: 'http://studio.example.com/api/media/file/logo.png',
    })
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
      domain: null,
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

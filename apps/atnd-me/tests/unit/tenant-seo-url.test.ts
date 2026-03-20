import { afterEach, describe, expect, it, vi } from 'vitest'

import { getTenantContext, getTenantWithBranding } from '../../src/utilities/getTenantContext'
import { getTenantSiteURL } from '../../src/utilities/getURL'

describe('tenant SEO URL resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers a tenant custom domain over the platform subdomain', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    expect(getTenantSiteURL({ slug: 'bru', domain: 'bru.ie' })).toBe('https://bru.ie')
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
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [{ id: 7, slug: 'bru', name: 'Bru Grappling', domain: 'bru.ie' }] }),
    }

    const tenant = await getTenantContext(payload as never, {
      headers: new Headers({ host: 'bru.ie' }),
    })

    expect(tenant).toMatchObject({
      id: 7,
      slug: 'bru',
      name: 'Bru Grappling',
      domain: 'bru.ie',
    })
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
              domain: null,
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

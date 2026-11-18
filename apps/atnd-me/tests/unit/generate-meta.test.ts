import { afterEach, describe, expect, it, vi } from 'vitest'

import { generateMeta } from '../../src/utilities/generateMeta'

const tenantBranding = {
  id: 7,
  slug: 'bru',
  name: 'Bru Grappling',
  hostnames: ['www.bru.ie'],
  direction: 'allow-www-and-non-www',
}

describe('page titles in generated metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('names a page by its own title when it has no meta title', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    const meta = await generateMeta({
      doc: { title: 'Beginners', slug: 'beginners' },
      tenantBranding,
      pathname: '/beginners',
    })

    // The root layout template adds the tenant name to a string title.
    expect(meta.title).toBe('Beginners')
    expect(meta.openGraph?.title).toBe('Beginners | Bru Grappling')
    expect(meta.twitter?.title).toBe('Beginners | Bru Grappling')
  })

  it('prefers the meta title over the page title', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    const meta = await generateMeta({
      doc: {
        title: 'Kids',
        slug: 'kids',
        meta: { title: 'Kids Classes in Dundrum' },
      },
      tenantBranding,
      pathname: '/kids',
    })

    expect(meta.title).toBe('Kids Classes in Dundrum')
    expect(meta.openGraph?.title).toBe('Kids Classes in Dundrum | Bru Grappling')
  })

  it('names the home page by the tenant alone when it has no meta title', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')

    const meta = await generateMeta({
      doc: { title: 'Home', slug: 'home' },
      tenantBranding,
      pathname: '/',
    })

    expect(meta.title).toEqual({ absolute: 'Bru Grappling' })
    expect(meta.openGraph?.title).toBe('Bru Grappling')
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/utilities/mergeOpenGraph', () => ({
  mergeOpenGraph: (og: Record<string, unknown>) => og,
}))

import { generateMeta } from '../../src/utilities/generateMeta'

describe('generateMeta Open Graph images', () => {
  it('uses the absolute CMS media URL instead of prefixing the tenant host', async () => {
    const metadata = await generateMeta({
      doc: {
        slug: 'home',
        meta: {
          title: 'Brú Grappling Studio',
          description: 'BJJ in Dublin',
          image: {
            url: 'https://atnd.me/api/media/file/DoubleLeg-1-1200x630.webp',
            sizes: {
              og: { url: 'https://atnd.me/api/media/file/DoubleLeg-1-1200x630.webp' },
            },
          } as never,
        },
      },
      tenantBranding: { id: 1, slug: 'brugrappling', name: 'Brú Grappling', domain: 'www.brugrappling.ie' },
      pathname: '/',
      headers: new Headers({ host: 'www.brugrappling.ie', 'x-forwarded-proto': 'https' }),
    })

    const image = metadata.openGraph?.images
    const url = Array.isArray(image) ? (image[0] as { url?: string })?.url : undefined

    expect(url).toBe('https://atnd.me/api/media/file/DoubleLeg-1-1200x630.webp')
    expect(metadata.alternates?.canonical).toBe('https://www.brugrappling.ie/')
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })
})

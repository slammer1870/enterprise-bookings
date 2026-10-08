import { describe, expect, it } from 'vitest'

import redirects from '../../redirects.js'

describe('legacy blog SEO redirects', () => {
  it('permanently sends /blog and /blog/* to /posts', async () => {
    const rules = await redirects()

    expect(rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/blog',
          destination: '/posts',
          permanent: true,
        }),
        expect.objectContaining({
          source: '/blog/:path*',
          destination: '/posts/:path*',
          permanent: true,
        }),
      ]),
    )
  })
})

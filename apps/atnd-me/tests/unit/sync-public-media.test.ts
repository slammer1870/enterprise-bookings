import { describe, it, expect } from 'vitest'

import { collectMediaIds } from '@/utilities/syncPublicMedia'

describe('collectMediaIds', () => {
  it('collects image ids from user docs', () => {
    const ids = collectMediaIds({
      id: 1,
      name: 'Paddy',
      image: { id: 42, url: '/api/media/file/paddy.webp' },
    })

    expect(Array.from(ids)).toEqual([42])
  })

  it('collects numeric image relationship ids', () => {
    const ids = collectMediaIds({
      id: 1,
      image: 99,
    })

    expect(Array.from(ids)).toEqual([99])
  })

  it('ignores unrelated numeric fields', () => {
    const ids = collectMediaIds({
      id: 1,
      tenant: 7,
      user: 3,
    })

    expect(Array.from(ids)).toEqual([])
  })
})

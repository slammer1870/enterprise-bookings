import { describe, it, expect } from 'vitest'

import { collectMediaIds } from '@/utilities/syncPublicMedia'

describe('collectMediaIds', () => {
  it('collects profileImage ids from staff member docs', () => {
    const ids = collectMediaIds({
      id: 1,
      name: 'Paddy',
      profileImage: { id: 42, url: '/api/media/file/paddy.webp' },
    })

    expect(Array.from(ids)).toEqual([42])
  })

  it('collects numeric profileImage relationship ids', () => {
    const ids = collectMediaIds({
      id: 1,
      profileImage: 99,
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

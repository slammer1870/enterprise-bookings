import { describe, it, expect, vi } from 'vitest'

import { resolveLinkToUrl } from '../../src/utilities/getNavbarFooterForRequest'

describe('resolveLinkToUrl (navbar/footer link normalization)', () => {
  it('resolves reference links when value is an object with id (no slug)', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ slug: 'about' }),
    } as any

    const link = {
      type: 'reference',
      label: 'About',
      reference: { relationTo: 'pages', value: { id: 123 } },
    }

    const resolved = await resolveLinkToUrl(payload, link)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'pages', id: 123 }),
    )
    expect(resolved?.type).toBe('custom')
    expect(resolved?.url).toBe('/about')
  })

  it('handles legacy reference shape missing relationTo by trying pages then posts', async () => {
    const payload = {
      findByID: vi
        .fn()
        .mockRejectedValueOnce(new Error('not a page'))
        .mockResolvedValueOnce({ slug: 'news' }),
    } as any

    const link = {
      type: 'reference',
      label: 'News',
      reference: { value: 999 },
    }

    const resolved = await resolveLinkToUrl(payload, link)

    expect(payload.findByID).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ collection: 'pages', id: 999 }),
    )
    expect(payload.findByID).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ collection: 'posts', id: 999 }),
    )
    expect(resolved?.type).toBe('custom')
    expect(resolved?.url).toBe('/posts/news')
  })

  it('handles legacy primitive reference id (no relationTo wrapper)', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ slug: 'contact' }),
    } as any

    const link = {
      type: 'reference',
      label: 'Contact',
      reference: 42,
    }

    const resolved = await resolveLinkToUrl(payload, link)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'pages', id: 42 }),
    )
    expect(resolved?.type).toBe('custom')
    expect(resolved?.url).toBe('/contact')
  })

  it('recovers when findByID returns slug null by falling back to find() published doc', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ slug: null }),
      find: vi.fn().mockResolvedValue({ docs: [{ slug: 'pricing' }] }),
    } as any

    const link = {
      type: 'reference',
      label: 'Pricing',
      reference: { relationTo: 'pages', value: { id: 10, slug: null } },
    }

    const resolved = await resolveLinkToUrl(payload, link)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'pages', id: 10 }),
    )
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'pages', limit: 1 }),
    )
    expect(resolved?.type).toBe('custom')
    expect(resolved?.url).toBe('/pricing')
  })
})


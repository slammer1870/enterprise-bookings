import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import {
  TENANT_FAVICON_SIZE,
  absoluteLogoUrl,
  logoFileUrl,
  looksLikeImage,
  publicFaviconIcons,
  rasterizeFaviconPng,
  requestOrigin,
} from '@/lib/seo/tenantFavicon'

describe('public favicon metadata', () => {
  it('points a tenant icon at a same-origin 192px file', () => {
    const icons = publicFaviconIcons('tenant')
    const serialized = JSON.stringify(icons)
    expect(serialized).toContain('/favicon.ico')
    expect(serialized).toContain('192x192')
    expect(serialized).toContain('image/png')
    expect(serialized).not.toContain('/api/')
    expect(serialized).not.toContain('500x500')
    expect(serialized).not.toMatch(/https?:\/\//)
  })

  it('keeps the platform mark on the platform icon path', () => {
    const icons = publicFaviconIcons('platform')
    expect(JSON.stringify(icons)).toContain('/favicon.ico')
    expect(JSON.stringify(icons)).not.toContain('favicon.svg')
  })
})

describe('logoFileUrl', () => {
  it('prefers the square crop', () => {
    expect(
      logoFileUrl({
        url: 'https://atnd.me/api/media/file/logo.png',
        sizes: { square: { url: 'https://atnd.me/api/media/file/logo-500x500.png' } },
      }),
    ).toBe('https://atnd.me/api/media/file/logo-500x500.png')
  })

  it('falls back to the original when the square crop is missing', () => {
    expect(logoFileUrl({ url: '/api/media/file/logo.png', sizes: { square: { url: null } } })).toBe(
      '/api/media/file/logo.png',
    )
    expect(logoFileUrl(null)).toBeNull()
    expect(logoFileUrl(12)).toBeNull()
  })
})

describe('absoluteLogoUrl', () => {
  it('keeps an absolute media URL and resolves a relative one against the request origin', () => {
    expect(absoluteLogoUrl('https://atnd.me/api/media/file/logo.png', 'https://bru.ie')).toBe(
      'https://atnd.me/api/media/file/logo.png',
    )
    expect(absoluteLogoUrl('/api/media/file/logo.png', 'https://bru.ie')).toBe(
      'https://bru.ie/api/media/file/logo.png',
    )
    expect(absoluteLogoUrl('javascript:alert(1)', 'https://bru.ie')).toBeNull()
  })
})

describe('requestOrigin', () => {
  it('uses http for localhost and https for a public host', () => {
    expect(requestOrigin(new Headers({ host: 'acme.localhost:3000' }))).toBe(
      'http://acme.localhost:3000',
    )
    expect(requestOrigin(new Headers({ host: 'www.brugrappling.ie' }))).toBe(
      'https://www.brugrappling.ie',
    )
    expect(
      requestOrigin(
        new Headers({ host: 'www.brugrappling.ie', 'x-forwarded-proto': 'http' }),
      ),
    ).toBe('http://www.brugrappling.ie')
  })
})

describe('rasterizeFaviconPng', () => {
  it('emits a square PNG at the Google-eligible size', async () => {
    const source = await sharp({
      create: { width: 20, height: 40, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer()

    const png = await rasterizeFaviconPng(source)
    expect(looksLikeImage(png, 'image/png')).toBe(true)
    const meta = await sharp(png).metadata()
    expect(meta.width).toBe(TENANT_FAVICON_SIZE)
    expect(meta.height).toBe(TENANT_FAVICON_SIZE)
    expect(meta.format).toBe('png')
  })
})

import { describe, expect, it } from 'vitest'

import {
  buildBasicAuthEmailHtml,
  buildMagicLinkEmailHtml,
} from '@repo/better-auth-config/server'

describe('auth email templates branding', () => {
  it('renders magic-link header with logo when logoUrl is provided', () => {
    const html = buildMagicLinkEmailHtml({
      magicLink: 'https://example.com/magic',
      appName: 'Studio',
      logoUrl: 'https://cdn.example.com/logo.png',
    })
    expect(html).toContain('src="https://cdn.example.com/logo.png"')
    expect(html).toContain('alt="Studio"')
    expect(html).toContain('>Studio</h1>')
  })

  it('renders magic-link name-only header when logoUrl is omitted', () => {
    const html = buildMagicLinkEmailHtml({
      magicLink: 'https://example.com/magic',
      appName: 'Studio',
    })
    expect(html).not.toContain('<img')
    expect(html).toContain('>Studio</h1>')
  })

  it('escapes logo url in basic auth emails', () => {
    const html = buildBasicAuthEmailHtml({
      appName: 'Studio',
      logoUrl: 'https://cdn.example.com/a"b.png',
      title: 'Reset',
      body: 'Reset your password',
    })
    expect(html).toContain('https://cdn.example.com/a&quot;b.png')
    expect(html).not.toContain('a"b.png')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isCustomPublicHostname,
  isPlatformPublicHostname,
  platformSubdomainSlug,
  publicHostErrorHtml,
} from '../../src/utilities/publicHostOutcome'

describe('public host outcome helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('treats bare localhost as a platform public host', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3000')
    expect(isPlatformPublicHostname('localhost')).toBe(true)
    expect(isPlatformPublicHostname('tenant.localhost')).toBe(false)
  })

  it('detects custom public hostnames outside the platform domain', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')
    expect(isCustomPublicHostname('studio.example.com')).toBe(true)
    expect(isCustomPublicHostname('bru.atnd.test')).toBe(false)
  })

  it('extracts platform subdomain slugs', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://atnd.test')
    expect(platformSubdomainSlug('bru.atnd.test')).toBe('bru')
    expect(platformSubdomainSlug('atnd.test')).toBe(null)
  })

  it('builds minimal HTML error pages without icons', () => {
    expect(publicHostErrorHtml('unknown')).toContain('<title>Not found</title>')
    expect(publicHostErrorHtml('failed')).toContain('<title>Unavailable</title>')
    expect(publicHostErrorHtml('unknown')).toMatch(/noindex/i)
    expect(publicHostErrorHtml('unknown')).not.toMatch(/favicon/i)
  })
})

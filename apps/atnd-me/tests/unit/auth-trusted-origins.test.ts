import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getTrustedOrigins } from '../../src/lib/auth/options'

/**
 * Unit tests for auth trusted origins (Better Auth wildcard for subdomain multi-tenancy).
 * Mocks base URL via NEXT_PUBLIC_SERVER_URL and asserts wildcard pattern (e.g. https://*.atnd-me.com).
 */
describe('getTrustedOrigins', () => {
  const originalServerUrl = process.env.NEXT_PUBLIC_SERVER_URL
  const originalVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL

  afterEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl
    process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercel
  })

  describe('with NEXT_PUBLIC_SERVER_URL (production / Coolify)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd-me.com'
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    })

    it('includes base URL and wildcard origin for subdomains', () => {
      const origins = getTrustedOrigins()
      expect(origins).toContain('https://atnd-me.com')
      expect(origins).toContain('https://*.atnd-me.com')
    })

    it('uses full hostname so wildcard is *.atnd-me.com not *.me.com', () => {
      const origins = getTrustedOrigins()
      const wildcard = origins.find((o) => o.startsWith('https://*.'))
      expect(wildcard).toBe('https://*.atnd-me.com')
      expect(origins).not.toContain('https://*.me.com')
    })
  })

  describe('without NEXT_PUBLIC_SERVER_URL (localhost fallback)', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    })

    it('includes localhost base and wildcard *.localhost', () => {
      const origins = getTrustedOrigins()
      expect(origins).toContain('http://localhost:3000')
      expect(origins).toContain('http://*.localhost:3000')
    })
  })
})

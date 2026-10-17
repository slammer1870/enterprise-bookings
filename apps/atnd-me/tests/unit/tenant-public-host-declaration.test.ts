import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  getClaimedApex,
  getTenantPlatformSubdomain,
  mergeTenantPublicHostDeclaration,
  readHostnameDeclaration,
} from '@/utilities/tenantPublicHostDeclaration'

describe('tenantPublicHostDeclaration', () => {
  const origEnv = process.env

  beforeEach(() => {
    process.env = { ...origEnv, NEXT_PUBLIC_SERVER_URL: 'https://atnd.me/' }
  })

  afterEach(() => {
    process.env = origEnv
  })

  describe('getClaimedApex', () => {
    it('claims the registrable domain for a deep hostname', () => {
      expect(getClaimedApex('blog.shop.example.co.uk')).toBe('example.co.uk')
    })

    it('claims the hostname apex when it is already registrable', () => {
      expect(getClaimedApex('brugrappling.ie')).toBe('brugrappling.ie')
    })
  })

  describe('getTenantPlatformSubdomain', () => {
    it('builds slug.platform from NEXT_PUBLIC_SERVER_URL', () => {
      expect(getTenantPlatformSubdomain('studio')).toBe('studio.atnd.me')
    })
  })

  describe('mergeTenantPublicHostDeclaration', () => {
    it('merges a partial hostname list with the stored declaration', () => {
      const merged = mergeTenantPublicHostDeclaration(
        { direction: 'redirect-to-www' },
        { hostnames: ['www.example.com', 'example.com'], slug: 'studio' },
      )
      expect(merged).toEqual({
        hostnames: ['www.example.com', 'example.com'],
        direction: 'redirect-to-www',
        slug: 'studio',
      })
    })

    it('treats a missing hostname list as empty', () => {
      const merged = mergeTenantPublicHostDeclaration({}, { slug: 'studio' })
      expect(merged.hostnames).toEqual([])
      expect(merged.direction).toBe('allow-www-and-non-www')
    })
  })

  describe('readHostnameDeclaration', () => {
    it('derives the platform subdomain when no hostname list is stored', () => {
      const read = readHostnameDeclaration({ slug: 'studio' })
      expect(read.hostnames).toEqual([])
      expect(read.direction).toBe('allow-www-and-non-www')
      expect(read.roles).toEqual({
        canonicalHost: 'studio.atnd.me',
        servingHosts: ['studio.atnd.me'],
        aliases: [],
      })
    })

    it('derives example.com as canonical and www.example.com as serving when both are allowed', () => {
      const read = readHostnameDeclaration({
        hostnames: ['www.example.com', 'example.com'],
        direction: 'allow-www-and-non-www',
        slug: 'studio',
      })
      expect(read.roles).toEqual({
        canonicalHost: 'example.com',
        servingHosts: ['www.example.com', 'example.com'],
        aliases: [{ host: 'studio.atnd.me', target: 'example.com' }],
      })
    })

    it('derives www.example.com as canonical and example.com as an alias to it when redirecting to www', () => {
      const read = readHostnameDeclaration({
        hostnames: ['www.example.com', 'example.com'],
        direction: 'redirect-to-www',
        slug: 'studio',
      })
      expect(read.roles).toEqual({
        canonicalHost: 'www.example.com',
        servingHosts: ['www.example.com'],
        aliases: [
          { host: 'example.com', target: 'www.example.com' },
          { host: 'studio.atnd.me', target: 'www.example.com' },
        ],
      })
    })

    it('derives example.com as canonical and www.example.com as an alias to it when redirecting to non-www', () => {
      const read = readHostnameDeclaration({
        hostnames: ['www.example.com', 'example.com'],
        direction: 'redirect-to-non-www',
        slug: 'studio',
      })
      expect(read.roles).toEqual({
        canonicalHost: 'example.com',
        servingHosts: ['example.com'],
        aliases: [
          { host: 'www.example.com', target: 'example.com' },
          { host: 'studio.atnd.me', target: 'example.com' },
        ],
      })
    })

    it('chooses www of the first hostname when redirecting to www and that www host is named', () => {
      const read = readHostnameDeclaration({
        hostnames: ['example.com', 'www.example.com'],
        direction: 'redirect-to-www',
        slug: 'studio',
      })
      expect(read.roles?.canonicalHost).toBe('www.example.com')
    })

    it('chooses the apex of the first hostname when that apex is named and direction is not redirect to www', () => {
      const read = readHostnameDeclaration({
        hostnames: ['www.example.co.uk', 'example.co.uk'],
        direction: 'allow-www-and-non-www',
        slug: 'studio',
      })
      expect(read.roles?.canonicalHost).toBe('example.co.uk')
    })

    it('chooses the first hostname when neither its www host nor its apex is named', () => {
      const read = readHostnameDeclaration({
        hostnames: ['blog.example.co.uk'],
        direction: 'allow-www-and-non-www',
        slug: 'studio',
      })
      expect(read.roles).toEqual({
        canonicalHost: 'blog.example.co.uk',
        servingHosts: ['blog.example.co.uk'],
        aliases: [{ host: 'studio.atnd.me', target: 'blog.example.co.uk' }],
      })
    })

    it('serves a named hostname that is not in a complete pair and does not invent the partner', () => {
      const read = readHostnameDeclaration({
        hostnames: ['www.other.com', 'mysite.example.com'],
        direction: 'allow-www-and-non-www',
        slug: 'studio',
      })
      expect(read.roles).toEqual({
        canonicalHost: 'www.other.com',
        servingHosts: ['www.other.com', 'mysite.example.com'],
        aliases: [{ host: 'studio.atnd.me', target: 'www.other.com' }],
      })
    })

    it('follows the same direction inside a later pair without making that serving host canonical', () => {
      const read = readHostnameDeclaration({
        hostnames: ['www.example.com', 'example.com', 'www.other.com', 'other.com'],
        direction: 'redirect-to-non-www',
        slug: 'studio',
      })
      expect(read.roles).toEqual({
        canonicalHost: 'example.com',
        servingHosts: ['example.com', 'other.com'],
        aliases: [
          { host: 'www.example.com', target: 'example.com' },
          { host: 'www.other.com', target: 'other.com' },
          { host: 'studio.atnd.me', target: 'example.com' },
        ],
      })
    })

    it('makes the platform subdomain the canonical host and the only serving host when the list is empty', () => {
      const read = readHostnameDeclaration({
        hostnames: [],
        direction: 'allow-www-and-non-www',
        slug: 'studio',
      })
      expect(read.direction).toBe('allow-www-and-non-www')
      expect(read.roles).toEqual({
        canonicalHost: 'studio.atnd.me',
        servingHosts: ['studio.atnd.me'],
        aliases: [],
      })
    })
  })
})

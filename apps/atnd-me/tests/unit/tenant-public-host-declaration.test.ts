import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  getClaimedApex,
  getTenantPlatformSubdomain,
  mergeTenantPublicHostDeclaration,
  readHostnameDeclaration,
  validateTenantPublicHostDeclarationStructure,
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

  describe('validateTenantPublicHostDeclarationStructure', () => {
    it('refuses alias hosts when no canonical host is named', () => {
      const result = validateTenantPublicHostDeclarationStructure({
        canonicalHost: null,
        aliasHosts: ['www.example.com'],
        slug: 'studio',
      })
      expect(result).not.toBe(true)
    })

    it('refuses clearing the canonical host while aliases remain', () => {
      const result = validateTenantPublicHostDeclarationStructure({
        canonicalHost: null,
        aliasHosts: ['www.example.com'],
        slug: 'studio',
        previousCanonicalHost: 'example.com',
      })
      expect(result).not.toBe(true)
    })

    it('refuses duplicate hostnames on the same tenant', () => {
      const result = validateTenantPublicHostDeclarationStructure({
        canonicalHost: 'example.com',
        aliasHosts: ['www.example.com', 'www.example.com'],
        slug: 'studio',
      })
      expect(result).not.toBe(true)
    })

    it('refuses the canonical host listed as its own alias', () => {
      const result = validateTenantPublicHostDeclarationStructure({
        canonicalHost: 'example.com',
        aliasHosts: ['www.example.com', 'example.com'],
        slug: 'studio',
      })
      expect(result).not.toBe(true)
    })

    it('accepts a canonical host with distinct aliases', () => {
      const result = validateTenantPublicHostDeclarationStructure({
        canonicalHost: 'example.com',
        aliasHosts: ['www.example.com', 'other.example.org'],
        slug: 'studio',
      })
      expect(result).toBe(true)
    })
  })

  describe('mergeTenantPublicHostDeclaration', () => {
    it('merges partial updates with the stored declaration', () => {
      const merged = mergeTenantPublicHostDeclaration(
        { aliasHosts: ['www.example.com'] },
        { domain: 'example.com', aliasHosts: [], slug: 'studio' },
      )
      expect(merged).toEqual({
        canonicalHost: 'example.com',
        aliasHosts: ['www.example.com'],
        hostnames: null,
        direction: 'allow-www-and-non-www',
        slug: 'studio',
      })
    })
  })

  describe('readHostnameDeclaration', () => {
    it('leaves a row that has no hostname list without derived roles', () => {
      const read = readHostnameDeclaration({
        domain: 'www.example.com',
        aliasHosts: ['example.com'],
        slug: 'studio',
      })
      expect(read.hostnames).toBeNull()
      expect(read.direction).toBe('allow-www-and-non-www')
      expect(read.roles).toBeNull()
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

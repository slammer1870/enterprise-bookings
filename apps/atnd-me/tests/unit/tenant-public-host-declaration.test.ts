import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  getClaimedApex,
  getTenantPlatformSubdomain,
  mergeTenantPublicHostDeclaration,
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
        slug: 'studio',
      })
    })
  })
})

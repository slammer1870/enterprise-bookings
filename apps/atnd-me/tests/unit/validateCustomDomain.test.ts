/**
 * Unit tests for tenant custom domain validation:
 * - format, normalization, not-platform (existing)
 * - isCustomDomainDnsValidationEnabled (env gate)
 * - validateCustomDomainDns (with mocked dns.promises)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn() },
}))

import dns from 'node:dns/promises'
import {
  getPlatformRootHostname,
  normalizeCustomDomain,
  validateCustomDomainFormat,
  validateCustomDomainNotPlatform,
  isCustomDomainDnsValidationEnabled,
  validateCustomDomainDns,
} from '@/utilities/validateCustomDomain'

const lookupMock = vi.mocked(dns.lookup)

describe('validateCustomDomain', () => {
  const origEnv = process.env

  beforeEach(() => {
    vi.restoreAllMocks()
    process.env = { ...origEnv }
    lookupMock.mockReset()
  })

  afterEach(() => {
    process.env = origEnv
  })

  describe('normalizeCustomDomain', () => {
    it('trims and lowercases', () => {
      expect(normalizeCustomDomain('  Studio.Example.COM  ')).toBe('studio.example.com')
    })

    it('strips port', () => {
      expect(normalizeCustomDomain('studio.example.com:443')).toBe('studio.example.com')
      expect(normalizeCustomDomain('studio.example.com:3000')).toBe('studio.example.com')
    })

    it('returns empty string for empty input', () => {
      expect(normalizeCustomDomain('')).toBe('')
      expect(normalizeCustomDomain('   ')).toBe('')
    })
  })

  describe('validateCustomDomainFormat', () => {
    it('accepts empty or null (optional field)', () => {
      expect(validateCustomDomainFormat(null)).toBe(true)
      expect(validateCustomDomainFormat(undefined)).toBe(true)
      expect(validateCustomDomainFormat('')).toBe(true)
      expect(validateCustomDomainFormat('   ')).toBe(true)
    })

    it('accepts valid hostnames', () => {
      expect(validateCustomDomainFormat('studio.example.com')).toBe(true)
      expect(validateCustomDomainFormat('my-studio.co.uk')).toBe(true)
      expect(validateCustomDomainFormat('sub.domain.example.com')).toBe(true)
    })

    it('rejects protocol or path', () => {
      expect(validateCustomDomainFormat('https://studio.example.com')).not.toBe(true)
      expect(validateCustomDomainFormat('http://studio.example.com')).not.toBe(true)
      expect(validateCustomDomainFormat('studio.example.com/path')).not.toBe(true)
    })

    it('rejects leading or trailing dots', () => {
      expect(validateCustomDomainFormat('.studio.example.com')).not.toBe(true)
      expect(validateCustomDomainFormat('studio.example.com.')).not.toBe(true)
    })

    it('rejects empty labels (consecutive dots)', () => {
      expect(validateCustomDomainFormat('studio..example.com')).not.toBe(true)
    })

    it('rejects single-label hostname', () => {
      expect(validateCustomDomainFormat('studio')).not.toBe(true)
    })

    it('rejects localhost', () => {
      expect(validateCustomDomainFormat('localhost')).not.toBe(true)
      expect(validateCustomDomainFormat('app.localhost')).not.toBe(true)
    })

    it('rejects hostname over 253 chars', () => {
      const long = 'a.' + 'b'.repeat(250)
      expect(validateCustomDomainFormat(long)).not.toBe(true)
    })
  })

  describe('validateCustomDomainNotPlatform', () => {
    it('returns true when NEXT_PUBLIC_SERVER_URL is unset', () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      expect(validateCustomDomainNotPlatform('studio.example.com')).toBe(true)
    })

    it('rejects when domain equals platform root hostname', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd.me/'
      expect(validateCustomDomainNotPlatform('atnd.me')).not.toBe(true)
      expect(validateCustomDomainNotPlatform('atnd.me')).toContain('atnd.me')
    })

    it('rejects when domain is subdomain of platform', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd.me/'
      expect(validateCustomDomainNotPlatform('tenant.atnd.me')).not.toBe(true)
      expect(validateCustomDomainNotPlatform('tenant.atnd.me')).toContain('subdomain')
    })

    it('accepts when domain is different from platform', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd.me/'
      expect(validateCustomDomainNotPlatform('studio.example.com')).toBe(true)
    })
  })

  describe('getPlatformRootHostname', () => {
    it('returns hostname from NEXT_PUBLIC_SERVER_URL', () => {
      process.env.NEXT_PUBLIC_SERVER_URL = 'https://atnd.me/'
      expect(getPlatformRootHostname()).toBe('atnd.me')
    })

    it('returns null when unset', () => {
      delete process.env.NEXT_PUBLIC_SERVER_URL
      expect(getPlatformRootHostname()).toBe(null)
    })
  })

  describe('isCustomDomainDnsValidationEnabled', () => {
    it('returns true only when VALIDATE_TENANT_CUSTOM_DOMAIN_DNS is "true"', () => {
      process.env.VALIDATE_TENANT_CUSTOM_DOMAIN_DNS = 'true'
      expect(isCustomDomainDnsValidationEnabled()).toBe(true)

      process.env.VALIDATE_TENANT_CUSTOM_DOMAIN_DNS = 'false'
      expect(isCustomDomainDnsValidationEnabled()).toBe(false)

      delete process.env.VALIDATE_TENANT_CUSTOM_DOMAIN_DNS
      expect(isCustomDomainDnsValidationEnabled()).toBe(false)

      process.env.VALIDATE_TENANT_CUSTOM_DOMAIN_DNS = '1'
      expect(isCustomDomainDnsValidationEnabled()).toBe(false)
    })
  })

  describe('validateCustomDomainDns', () => {
    it('returns true when dns.lookup resolves', async () => {
      lookupMock.mockResolvedValue(undefined)
      const result = await validateCustomDomainDns('studio.example.com')
      expect(result).toBe(true)
      expect(lookupMock).toHaveBeenCalledWith('studio.example.com', { all: false })
    })

    it('returns error message when ENOTFOUND', async () => {
      const err = new Error('getaddrinfo ENOTFOUND studio.example.com') as NodeJS.ErrnoException
      err.code = 'ENOTFOUND'
      lookupMock.mockRejectedValue(err)
      const result = await validateCustomDomainDns('studio.example.com')
      expect(result).not.toBe(true)
      expect(typeof result).toBe('string')
      expect(result).toContain('studio.example.com')
      expect(result).toContain('no A or AAAA records')
    })

    it('returns error message when ETIMEOUT', async () => {
      const err = new Error('queryA ETIMEOUT studio.example.com') as NodeJS.ErrnoException
      err.code = 'ETIMEOUT'
      lookupMock.mockRejectedValue(err)
      const result = await validateCustomDomainDns('studio.example.com')
      expect(result).not.toBe(true)
      expect(result).toContain('no A or AAAA records')
    })

    it('returns error message when ENODATA', async () => {
      const err = new Error('queryA ENODATA studio.example.com') as NodeJS.ErrnoException
      err.code = 'ENODATA'
      lookupMock.mockRejectedValue(err)
      const result = await validateCustomDomainDns('studio.example.com')
      expect(result).not.toBe(true)
      expect(result).toContain('no DNS records')
    })

    it('returns generic error for other error codes', async () => {
      const err = new Error('refused') as NodeJS.ErrnoException
      err.code = 'ECONNREFUSED'
      lookupMock.mockRejectedValue(err)
      const result = await validateCustomDomainDns('studio.example.com')
      expect(result).not.toBe(true)
      expect(result).toContain('could not be verified')
      expect(result).toContain('ECONNREFUSED')
    })

    it('returns timeout message when lookup rejects with no code (simulated timeout)', async () => {
      lookupMock.mockRejectedValue(new Error('DNS lookup timed out'))
      const result = await validateCustomDomainDns('studio.example.com')
      expect(result).not.toBe(true)
      expect(result).toContain('timed out')
    })
  })
})

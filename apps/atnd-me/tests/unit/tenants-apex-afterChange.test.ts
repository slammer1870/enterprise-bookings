/**
 * Unit tests for the apex domain afterChange hook logic.
 *
 * Mirrors the pattern in register-apple-pay-domain.test.ts: extract the pure
 * routing/decision function so it can be tested without Payload or the DB.
 */
import { describe, it, expect } from 'vitest'
import { collectApexActionsFromHookArgs } from '@/collections/Tenants/apexDomainHook'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApexHookArgs = {
  doc: {
    domain?: string | null
    redirectApex?: boolean | null
    apexDomain?: string | null
  }
  previousDoc: {
    domain?: string | null
    redirectApex?: boolean | null
  }
  operation: 'create' | 'update'
}

type ApexActions = {
  /** Apex hostname to register (Cloudflare + Apple Pay). Null = nothing to register. */
  registerApex: string | null
  /** Derived apex to write into the apexDomain column. Null = clear the column. */
  apexDomainToStore: string | null
  /** When true, the token field should be cleared (redirectApex was turned off). */
  clearToken: boolean
  /** Main custom domain to register as a Cloudflare custom hostname. Null = no change. */
  registerDomain: string | null
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collectApexActionsFromHookArgs', () => {
  it('returns registerApex and apexDomainToStore for a new www.* domain with redirectApex true', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'www.croilan.com', redirectApex: true, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerApex).toBe('croilan.com')
    expect(result.apexDomainToStore).toBe('croilan.com')
    expect(result.clearToken).toBe(false)
  })

  it('returns registerApex for a non-www subdomain when redirectApex is true', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'booking.croilan.com', redirectApex: true, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerApex).toBe('croilan.com')
    expect(result.apexDomainToStore).toBe('croilan.com')
    expect(result.clearToken).toBe(false)
  })

  it('returns no actions when redirectApex is false', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'www.croilan.com', redirectApex: false, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerApex).toBeNull()
    expect(result.apexDomainToStore).toBeNull()
    expect(result.clearToken).toBe(false)
  })

  it('clears token when redirectApex is toggled off', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'www.croilan.com', redirectApex: false, apexDomain: 'croilan.com' },
      previousDoc: { domain: 'www.croilan.com', redirectApex: true },
      operation: 'update',
    })
    expect(result.registerApex).toBeNull()
    expect(result.apexDomainToStore).toBeNull()
    expect(result.clearToken).toBe(true)
  })

  it('re-registers when domain changes and redirectApex stays true', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'www.new-domain.com', redirectApex: true, apexDomain: 'old-domain.com' },
      previousDoc: { domain: 'www.old-domain.com', redirectApex: true },
      operation: 'update',
    })
    expect(result.registerApex).toBe('new-domain.com')
    expect(result.apexDomainToStore).toBe('new-domain.com')
    expect(result.clearToken).toBe(false)
  })

  it('does not re-register when neither domain nor redirectApex changed', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'www.croilan.com', redirectApex: true, apexDomain: 'croilan.com' },
      previousDoc: { domain: 'www.croilan.com', redirectApex: true },
      operation: 'update',
    })
    expect(result.registerApex).toBeNull()
    expect(result.apexDomainToStore).toBeNull()
    expect(result.clearToken).toBe(false)
  })

  it('registers on create even when domain and redirectApex match previousDoc', () => {
    // On create, previousDoc fields are typically empty/null; operation=create always registers.
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'www.croilan.com', redirectApex: true, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerApex).toBe('croilan.com')
  })

  it('returns null registerApex when domain cannot be stripped (only two labels)', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'croilan.com', redirectApex: true, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerApex).toBeNull()
    expect(result.apexDomainToStore).toBeNull()
  })

  it('returns null registerApex when domain is missing', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: null, redirectApex: true, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerApex).toBeNull()
  })
})

describe('collectApexActionsFromHookArgs — registerDomain (Cloudflare custom hostname for main domain)', () => {
  it('registers the domain on create', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'test.example.com', redirectApex: false, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerDomain).toBe('test.example.com')
  })

  it('registers the domain on update when domain changes', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'new.example.com', redirectApex: false, apexDomain: null },
      previousDoc: { domain: 'old.example.com', redirectApex: false },
      operation: 'update',
    })
    expect(result.registerDomain).toBe('new.example.com')
  })

  it('does not re-register when domain is unchanged on update', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'test.example.com', redirectApex: false, apexDomain: null },
      previousDoc: { domain: 'test.example.com', redirectApex: false },
      operation: 'update',
    })
    expect(result.registerDomain).toBeNull()
  })

  it('returns null when domain is cleared', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: null, redirectApex: false, apexDomain: null },
      previousDoc: { domain: 'test.example.com', redirectApex: false },
      operation: 'update',
    })
    expect(result.registerDomain).toBeNull()
  })

  it('also registers domain when redirectApex is true and domain changes', () => {
    const result = collectApexActionsFromHookArgs({
      doc: { domain: 'www.example.com', redirectApex: true, apexDomain: null },
      previousDoc: { domain: null, redirectApex: false },
      operation: 'create',
    })
    expect(result.registerDomain).toBe('www.example.com')
    expect(result.registerApex).toBe('example.com')
  })
})

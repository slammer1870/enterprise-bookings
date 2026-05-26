import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const { mockList, mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    paymentMethodDomains: {
      list: mockList,
      create: mockCreate,
      update: mockUpdate,
    },
  }),
}))

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { registerApplePayDomain } from '@/collections/Tenants/registerApplePayDomain'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDomain(overrides: { id?: string; domain_name?: string; enabled?: boolean } = {}) {
  return {
    id: 'pmd_test123',
    object: 'payment_method_domain' as const,
    domain_name: 'acme.example.com',
    enabled: true,
    apple_pay: { status: 'active' as const },
    google_pay: { status: 'active' as const },
    link: { status: 'active' as const },
    livemode: false,
    created: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerApplePayDomain', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  })

  it('does nothing when domain is already registered and enabled', async () => {
    mockList.mockResolvedValue({ data: [makeDomain()] })

    await registerApplePayDomain('acme.example.com')

    expect(mockList).toHaveBeenCalledWith({ domain_name: 'acme.example.com', limit: 1 }, undefined)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('re-enables a domain that exists but is disabled', async () => {
    mockList.mockResolvedValue({ data: [makeDomain({ id: 'pmd_disabled', enabled: false })] })
    mockUpdate.mockResolvedValue(makeDomain({ id: 'pmd_disabled', enabled: true }))

    await registerApplePayDomain('acme.example.com')

    expect(mockUpdate).toHaveBeenCalledWith('pmd_disabled', { enabled: true }, undefined)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates a new registration when the domain is not yet registered', async () => {
    mockList.mockResolvedValue({ data: [] })
    mockCreate.mockResolvedValue(makeDomain())

    await registerApplePayDomain('acme.example.com')

    expect(mockCreate).toHaveBeenCalledWith({ domain_name: 'acme.example.com' }, undefined)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('skips silently when STRIPE_SECRET_KEY is not set', async () => {
    delete process.env.STRIPE_SECRET_KEY

    await registerApplePayDomain('acme.example.com')

    expect(mockList).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('propagates unexpected errors from the Stripe list call', async () => {
    mockList.mockRejectedValue(new Error('Network error'))

    await expect(registerApplePayDomain('acme.example.com')).rejects.toThrow('Network error')
  })

  it('passes stripeAccount request option when stripeAccountId is provided', async () => {
    mockList.mockResolvedValue({ data: [] })
    mockCreate.mockResolvedValue(makeDomain())

    await registerApplePayDomain('acme.example.com', 'acct_connected123')

    expect(mockList).toHaveBeenCalledWith(
      { domain_name: 'acme.example.com', limit: 1 },
      { stripeAccount: 'acct_connected123' },
    )
    expect(mockCreate).toHaveBeenCalledWith(
      { domain_name: 'acme.example.com' },
      { stripeAccount: 'acct_connected123' },
    )
  })

  it('re-enables a disabled domain on a connected account', async () => {
    mockList.mockResolvedValue({ data: [makeDomain({ id: 'pmd_con', enabled: false })] })
    mockUpdate.mockResolvedValue(makeDomain({ id: 'pmd_con', enabled: true }))

    await registerApplePayDomain('acme.example.com', 'acct_connected123')

    expect(mockUpdate).toHaveBeenCalledWith(
      'pmd_con',
      { enabled: true },
      { stripeAccount: 'acct_connected123' },
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Tenant afterChange hook subdomain coverage
// ---------------------------------------------------------------------------
// The logic below mirrors the hook in src/collections/Tenants/index.ts so we
// can unit-test domain collection without spinning up Payload.

function collectDomainsFromHookArgs({
  doc,
  previousDoc,
  operation,
  rootHostname,
}: {
  doc: { slug?: string | null; domain?: string | null }
  previousDoc: { slug?: string | null; domain?: string | null }
  operation: 'create' | 'update'
  rootHostname: string | null
}): string[] {
  const domains: string[] = []

  const newSlug = typeof doc.slug === 'string' ? doc.slug.trim() : null
  const prevSlug = typeof previousDoc.slug === 'string' ? previousDoc.slug.trim() : null
  if (newSlug && rootHostname && (operation === 'create' || newSlug !== prevSlug)) {
    domains.push(`${newSlug}.${rootHostname}`)
  }

  const newDomain = typeof doc.domain === 'string' && doc.domain.trim() ? doc.domain.trim() : null
  const prevDomain =
    typeof previousDoc.domain === 'string' && previousDoc.domain.trim()
      ? previousDoc.domain.trim()
      : null
  if (newDomain && newDomain !== prevDomain) {
    domains.push(newDomain)
  }

  return domains
}

describe('Tenants afterChange — domain collection logic', () => {
  const ROOT = 'atnd-me.com'

  it('registers the platform subdomain on tenant create', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme', domain: null },
      previousDoc: { slug: null, domain: null },
      operation: 'create',
      rootHostname: ROOT,
    })
    expect(domains).toEqual(['acme.atnd-me.com'])
  })

  it('registers both subdomain and custom domain on create when both are set', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme', domain: 'acme.com' },
      previousDoc: { slug: null, domain: null },
      operation: 'create',
      rootHostname: ROOT,
    })
    expect(domains).toEqual(['acme.atnd-me.com', 'acme.com'])
  })

  it('registers the new subdomain when the slug changes on update', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme-new', domain: null },
      previousDoc: { slug: 'acme-old', domain: null },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(domains).toEqual(['acme-new.atnd-me.com'])
  })

  it('does not re-register subdomain when slug is unchanged on update', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme', domain: null },
      previousDoc: { slug: 'acme', domain: null },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(domains).toEqual([])
  })

  it('registers custom domain when it is added on update', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme', domain: 'acme.com' },
      previousDoc: { slug: 'acme', domain: null },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(domains).toEqual(['acme.com'])
  })

  it('registers new custom domain when it changes on update', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme', domain: 'new.acme.com' },
      previousDoc: { slug: 'acme', domain: 'old.acme.com' },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(domains).toEqual(['new.acme.com'])
  })

  it('does nothing when neither slug nor domain changed', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme', domain: 'acme.com' },
      previousDoc: { slug: 'acme', domain: 'acme.com' },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(domains).toEqual([])
  })

  it('does not register subdomain when NEXT_PUBLIC_SERVER_URL is not set (rootHostname null)', () => {
    const domains = collectDomainsFromHookArgs({
      doc: { slug: 'acme', domain: null },
      previousDoc: { slug: null, domain: null },
      operation: 'create',
      rootHostname: null,
    })
    expect(domains).toEqual([])
  })
})

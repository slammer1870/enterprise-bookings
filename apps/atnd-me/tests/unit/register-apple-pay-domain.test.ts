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
// Tenant afterChange hook domain collection logic
// ---------------------------------------------------------------------------
// Mirrors the hook in src/collections/Tenants/index.ts so the routing logic
// can be unit-tested without spinning up Payload.

type HookArgs = {
  doc: { slug?: string | null; domain?: string | null; stripeConnectAccountId?: string | null }
  previousDoc: { slug?: string | null; domain?: string | null }
  operation: 'create' | 'update'
  rootHostname: string | null
}

function collectRegistrationsFromHookArgs(args: HookArgs): {
  platform: string[]
  connected: string[]
} {
  const { doc, previousDoc, operation, rootHostname } = args

  const newSlug = typeof doc.slug === 'string' ? doc.slug.trim() : null
  const prevSlug = typeof previousDoc.slug === 'string' ? previousDoc.slug.trim() : null
  const newDomain = typeof doc.domain === 'string' && doc.domain.trim() ? doc.domain.trim() : null
  const prevDomain =
    typeof previousDoc.domain === 'string' && previousDoc.domain.trim()
      ? previousDoc.domain.trim()
      : null
  const connectedAccountId =
    typeof doc.stripeConnectAccountId === 'string' && doc.stripeConnectAccountId.trim()
      ? doc.stripeConnectAccountId.trim()
      : null

  const platform: string[] = []
  if (newSlug && rootHostname && (operation === 'create' || newSlug !== prevSlug)) {
    platform.push(`${newSlug}.${rootHostname}`)
  }
  if (newDomain && newDomain !== prevDomain) {
    platform.push(newDomain)
  }

  const connected: string[] = []
  if (connectedAccountId && platform.length > 0) {
    if (newSlug && rootHostname) connected.push(`${newSlug}.${rootHostname}`)
    if (newDomain) connected.push(newDomain)
  }

  return { platform, connected }
}

describe('Tenants afterChange — domain registration routing', () => {
  const ROOT = 'atnd-me.com'
  const ACCOUNT = 'acct_connected'

  it('registers the platform subdomain on create (no connected account)', () => {
    const { platform, connected } = collectRegistrationsFromHookArgs({
      doc: { slug: 'acme', domain: null, stripeConnectAccountId: null },
      previousDoc: { slug: null, domain: null },
      operation: 'create',
      rootHostname: ROOT,
    })
    expect(platform).toEqual(['acme.atnd-me.com'])
    expect(connected).toEqual([])
  })

  it('registers subdomain on both platform and connected account on create', () => {
    const { platform, connected } = collectRegistrationsFromHookArgs({
      doc: { slug: 'acme', domain: null, stripeConnectAccountId: ACCOUNT },
      previousDoc: { slug: null, domain: null },
      operation: 'create',
      rootHostname: ROOT,
    })
    expect(platform).toEqual(['acme.atnd-me.com'])
    expect(connected).toEqual(['acme.atnd-me.com'])
  })

  it('two-save trick: custom domain change also registers subdomain on connected account', () => {
    // Second save of the two-save trick: real domain replaces temp domain.
    // Connected account receives BOTH subdomain + custom domain even though
    // only the custom domain changed on the platform.
    const { platform, connected } = collectRegistrationsFromHookArgs({
      doc: { slug: 'acme', domain: 'acme.com', stripeConnectAccountId: ACCOUNT },
      previousDoc: { slug: 'acme', domain: 'temp.acme.com' },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(platform).toEqual(['acme.com'])
    expect(connected).toEqual(['acme.atnd-me.com', 'acme.com'])
  })

  it('slug change registers new subdomain on both platform and connected account', () => {
    const { platform, connected } = collectRegistrationsFromHookArgs({
      doc: { slug: 'acme-new', domain: 'acme.com', stripeConnectAccountId: ACCOUNT },
      previousDoc: { slug: 'acme-old', domain: 'acme.com' },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(platform).toEqual(['acme-new.atnd-me.com'])
    expect(connected).toEqual(['acme-new.atnd-me.com', 'acme.com'])
  })

  it('no registrations when nothing changed', () => {
    const { platform, connected } = collectRegistrationsFromHookArgs({
      doc: { slug: 'acme', domain: 'acme.com', stripeConnectAccountId: ACCOUNT },
      previousDoc: { slug: 'acme', domain: 'acme.com' },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(platform).toEqual([])
    expect(connected).toEqual([])
  })

  it('does not register on connected account when there is no connected account', () => {
    const { platform, connected } = collectRegistrationsFromHookArgs({
      doc: { slug: 'acme', domain: 'acme.com', stripeConnectAccountId: null },
      previousDoc: { slug: 'acme', domain: null },
      operation: 'update',
      rootHostname: ROOT,
    })
    expect(platform).toEqual(['acme.com'])
    expect(connected).toEqual([])
  })

  it('does not register subdomain when rootHostname is not set', () => {
    const { platform, connected } = collectRegistrationsFromHookArgs({
      doc: { slug: 'acme', domain: null, stripeConnectAccountId: ACCOUNT },
      previousDoc: { slug: null, domain: null },
      operation: 'create',
      rootHostname: null,
    })
    expect(platform).toEqual([])
    expect(connected).toEqual([])
  })
})

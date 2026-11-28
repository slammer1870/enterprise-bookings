import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const { mockList, mockCreate, mockUpdate, mockValidate } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockValidate: vi.fn(),
}))

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    paymentMethodDomains: {
      list: mockList,
      create: mockCreate,
      update: mockUpdate,
      validate: mockValidate,
    },
  }),
}))

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import {
  applePayDomainsForConnectedAccount,
  applePayDomainsForDeclaration,
  applePayRegistrationPlan,
  registerAllDomainsForConnectedAccount,
  registerApplePayDomain,
} from '@/collections/Tenants/registerApplePayDomain'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDomain(
  overrides: {
    id?: string
    domain_name?: string
    enabled?: boolean
    apple_pay?: { status: 'active' | 'inactive' }
  } = {},
) {
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

const ACCOUNT = 'acct_connected123'
const origEnv = process.env

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerApplePayDomain', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    delete process.env.SKIP_APPLE_PAY_DOMAIN_REGISTRATION
    delete process.env.ENABLE_TEST_WEBHOOKS
    delete process.env.PW_E2E_PROFILE
  })

  it('does nothing when domain is already registered, enabled, and Apple Pay is active', async () => {
    mockList.mockResolvedValue({ data: [makeDomain()] })

    await registerApplePayDomain('acme.example.com')

    expect(mockList).toHaveBeenCalledWith({ domain_name: 'acme.example.com', limit: 1 }, undefined)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('re-validates an enabled domain when Apple Pay is still inactive', async () => {
    mockList.mockResolvedValue({
      data: [makeDomain({ apple_pay: { status: 'inactive' } })],
    })
    mockValidate.mockResolvedValue(makeDomain())

    await registerApplePayDomain('acme.example.com')

    expect(mockValidate).toHaveBeenCalledWith('pmd_test123', undefined)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('re-enables a domain that exists but is disabled', async () => {
    mockList.mockResolvedValue({ data: [makeDomain({ id: 'pmd_disabled', enabled: false })] })
    mockUpdate.mockResolvedValue(makeDomain({ id: 'pmd_disabled', enabled: true }))

    await registerApplePayDomain('acme.example.com')

    expect(mockUpdate).toHaveBeenCalledWith('pmd_disabled', { enabled: true }, undefined)
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('creates a new registration when the domain is not yet registered', async () => {
    mockList.mockResolvedValue({ data: [] })
    mockCreate.mockResolvedValue(makeDomain())

    await registerApplePayDomain('acme.example.com')

    expect(mockCreate).toHaveBeenCalledWith({ domain_name: 'acme.example.com' }, undefined)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('validates a newly created domain when Apple Pay is inactive', async () => {
    mockList.mockResolvedValue({ data: [] })
    mockCreate.mockResolvedValue(
      makeDomain({ id: 'pmd_new', apple_pay: { status: 'inactive' } }),
    )
    mockValidate.mockResolvedValue(makeDomain({ id: 'pmd_new' }))

    await registerApplePayDomain('acme.example.com')

    expect(mockValidate).toHaveBeenCalledWith('pmd_new', undefined)
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

    await registerApplePayDomain('acme.example.com', ACCOUNT)

    expect(mockList).toHaveBeenCalledWith(
      { domain_name: 'acme.example.com', limit: 1 },
      { stripeAccount: ACCOUNT },
    )
    expect(mockCreate).toHaveBeenCalledWith(
      { domain_name: 'acme.example.com' },
      { stripeAccount: ACCOUNT },
    )
  })

  it('re-enables a disabled domain on a connected account', async () => {
    mockList.mockResolvedValue({ data: [makeDomain({ id: 'pmd_con', enabled: false })] })
    mockUpdate.mockResolvedValue(makeDomain({ id: 'pmd_con', enabled: true }))

    await registerApplePayDomain('acme.example.com', ACCOUNT)

    expect(mockUpdate).toHaveBeenCalledWith(
      'pmd_con',
      { enabled: true },
      { stripeAccount: ACCOUNT },
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('applePay domain lists and registration plan', () => {
  beforeEach(() => {
    process.env = { ...origEnv, NEXT_PUBLIC_SERVER_URL: 'https://atnd.me/' }
  })

  afterEach(() => {
    process.env = origEnv
  })

  it('uses the platform subdomain as the only serving host when the hostname list is empty', () => {
    expect(
      applePayDomainsForDeclaration({ slug: 'acme', hostnames: [], direction: 'allow-www-and-non-www' }),
    ).toEqual(['acme.atnd.me'])
    expect(
      applePayDomainsForConnectedAccount({
        slug: 'acme',
        hostnames: [],
        direction: 'allow-www-and-non-www',
      }),
    ).toEqual(['acme.atnd.me'])
  })

  it('keeps custom serving hosts on the platform and still adds the platform subdomain on the connected account', () => {
    const doc = {
      slug: 'acme',
      hostnames: ['www.acme.com', 'acme.com'],
      direction: 'allow-www-and-non-www' as const,
    }
    expect(applePayDomainsForDeclaration(doc)).toEqual(['www.acme.com', 'acme.com'])
    expect(applePayDomainsForConnectedAccount(doc)).toEqual([
      'www.acme.com',
      'acme.com',
      'acme.atnd.me',
    ])
  })

  it('registers the platform subdomain on create when there is no connected account', () => {
    const { platform, connected } = applePayRegistrationPlan({
      doc: { slug: 'acme', hostnames: [], direction: 'allow-www-and-non-www' },
      previousDoc: null,
      operation: 'create',
    })
    expect(platform).toEqual(['acme.atnd.me'])
    expect(connected).toEqual([])
  })

  it('registers the platform subdomain on both accounts when Connect is already attached at create', () => {
    const { platform, connected } = applePayRegistrationPlan({
      doc: {
        slug: 'acme',
        hostnames: [],
        direction: 'allow-www-and-non-www',
        stripeConnectAccountId: ACCOUNT,
      },
      previousDoc: null,
      operation: 'create',
    })
    expect(platform).toEqual(['acme.atnd.me'])
    expect(connected).toEqual(['acme.atnd.me'])
  })

  it('registers the platform subdomain on the connected account when Stripe Connect is attached later', () => {
    const { platform, connected } = applePayRegistrationPlan({
      doc: {
        slug: 'acme',
        hostnames: [],
        direction: 'allow-www-and-non-www',
        stripeConnectAccountId: ACCOUNT,
      },
      previousDoc: {
        slug: 'acme',
        hostnames: [],
        direction: 'allow-www-and-non-www',
        stripeConnectAccountId: null,
      },
      operation: 'update',
    })
    expect(platform).toEqual([])
    expect(connected).toEqual(['acme.atnd.me'])
  })

  it('adds the platform subdomain to the connected account when a custom hostname is saved', () => {
    const { platform, connected } = applePayRegistrationPlan({
      doc: {
        slug: 'acme',
        hostnames: ['www.acme.com', 'acme.com'],
        direction: 'allow-www-and-non-www',
        stripeConnectAccountId: ACCOUNT,
      },
      previousDoc: {
        slug: 'acme',
        hostnames: [],
        direction: 'allow-www-and-non-www',
        stripeConnectAccountId: ACCOUNT,
      },
      operation: 'update',
    })
    expect(platform).toEqual(['www.acme.com', 'acme.com'])
    expect(connected).toEqual(['www.acme.com', 'acme.com', 'acme.atnd.me'])
  })

  it('does not re-register when the serving set and connected account are unchanged', () => {
    const { platform, connected } = applePayRegistrationPlan({
      doc: {
        slug: 'acme',
        hostnames: ['www.acme.com'],
        direction: 'allow-www-and-non-www',
        stripeConnectAccountId: ACCOUNT,
      },
      previousDoc: {
        slug: 'acme',
        hostnames: ['www.acme.com'],
        direction: 'allow-www-and-non-www',
        stripeConnectAccountId: ACCOUNT,
      },
      operation: 'update',
    })
    expect(platform).toEqual([])
    expect(connected).toEqual([])
  })

  it('registerAllDomainsForConnectedAccount registers serving hosts plus the platform subdomain', async () => {
    vi.resetAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    delete process.env.SKIP_APPLE_PAY_DOMAIN_REGISTRATION
    delete process.env.ENABLE_TEST_WEBHOOKS
    delete process.env.PW_E2E_PROFILE
    mockList.mockResolvedValue({ data: [] })
    mockCreate.mockResolvedValue(makeDomain())

    const payload = {
      findByID: vi.fn().mockResolvedValue({
        slug: 'acme',
        hostnames: ['www.acme.com'],
        direction: 'allow-www-and-non-www',
      }),
    }

    await registerAllDomainsForConnectedAccount(payload as never, ACCOUNT, 1)

    expect(mockCreate).toHaveBeenCalledWith(
      { domain_name: 'www.acme.com' },
      { stripeAccount: ACCOUNT },
    )
    expect(mockCreate).toHaveBeenCalledWith(
      { domain_name: 'acme.atnd.me' },
      { stripeAccount: ACCOUNT },
    )
  })
})

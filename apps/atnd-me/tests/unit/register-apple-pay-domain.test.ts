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

    expect(mockList).toHaveBeenCalledWith({ domain_name: 'acme.example.com', limit: 1 })
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('re-enables a domain that exists but is disabled', async () => {
    mockList.mockResolvedValue({ data: [makeDomain({ id: 'pmd_disabled', enabled: false })] })
    mockUpdate.mockResolvedValue(makeDomain({ id: 'pmd_disabled', enabled: true }))

    await registerApplePayDomain('acme.example.com')

    expect(mockUpdate).toHaveBeenCalledWith('pmd_disabled', { enabled: true })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates a new registration when the domain is not yet registered', async () => {
    mockList.mockResolvedValue({ data: [] })
    mockCreate.mockResolvedValue(makeDomain())

    await registerApplePayDomain('acme.example.com')

    expect(mockCreate).toHaveBeenCalledWith({ domain_name: 'acme.example.com' })
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
})

/**
 * Gift voucher purchase stamps the selling branch from the staff site selector.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCreateGiftVoucherPaymentIntent,
  mockPayload,
  mockGetCurrentUser,
  mockResolveTenantSlugOrId,
  mockResolveTenantForConnect,
  mockIsStripeTestAccount,
} = vi.hoisted(() => ({
  mockCreateGiftVoucherPaymentIntent: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockResolveTenantSlugOrId: vi.fn(),
  mockResolveTenantForConnect: vi.fn(),
  mockIsStripeTestAccount: vi.fn().mockReturnValue(false),
  mockPayload: {
    findByID: vi.fn(),
  },
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
  resolveTenantSlugOrId: mockResolveTenantSlugOrId,
  resolveTenantForConnect: mockResolveTenantForConnect,
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: mockIsStripeTestAccount,
}))

vi.mock('@/lib/stripe-connect/createGiftVoucherPaymentIntent', () => ({
  createGiftVoucherPaymentIntent: mockCreateGiftVoucherPaymentIntent,
  validateGiftVoucherAmount: (amount: number) => amount >= 5 && amount <= 500,
  GIFT_VOUCHER_MIN_EUROS: 5,
  GIFT_VOUCHER_MAX_EUROS: 500,
}))

vi.mock('@repo/bookings-payments', () => ({
  ensureStripeCustomerIdForAccount: vi.fn(),
}))

import { POST } from '@/app/api/stripe/connect/purchase-gift-voucher/route'

const TENANT_ID = 11

function makeRequest(cookies: Record<string, string> = {}) {
  return {
    json: () =>
      Promise.resolve({
        amount: 25,
        name: 'Sam Buyer',
        email: 'sam@example.com',
        branchName: 'Client Branch',
        branchSlug: 'client-branch',
      }),
    headers: new Headers({ 'x-tenant-slug': 'demo' }),
    cookies: {
      get: (name: string) =>
        cookies[name] != null ? { name, value: cookies[name] } : undefined,
    },
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as import('next/server').NextRequest
}

describe('POST /api/stripe/connect/purchase-gift-voucher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStripeTestAccount.mockReturnValue(false)
    mockGetCurrentUser.mockResolvedValue(null)
    mockResolveTenantSlugOrId.mockReturnValue('demo')
    mockResolveTenantForConnect.mockResolvedValue({
      id: TENANT_ID,
      stripeConnectAccountId: 'acct_1RealConnectAccount',
      stripeConnectOnboardingStatus: 'active',
    })
    mockCreateGiftVoucherPaymentIntent.mockResolvedValue({
      id: 'pi_voucher',
      client_secret: 'pi_voucher_secret',
      voucherAmountCents: 2500,
      bookingFeeAmountCents: 0,
      totalAmountCents: 2500,
    })
    mockPayload.findByID.mockImplementation(
      ({ collection, id }: { collection: string; id?: number }) => {
        if (collection === 'locations' && id === 12) {
          return Promise.resolve({
            id: 12,
            name: 'Rathmines',
            slug: 'rathmines',
            tenant: TENANT_ID,
          })
        }
        return Promise.resolve(null)
      },
    )
  })

  it('stamps the site-selector branch and ignores a client branch name', async () => {
    const res = await POST(makeRequest({ 'payload-location': '12' }))

    expect(res.status).toBe(200)
    expect(mockCreateGiftVoucherPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        branch: { name: 'Rathmines', slug: 'rathmines' },
      }),
    )
  })
})

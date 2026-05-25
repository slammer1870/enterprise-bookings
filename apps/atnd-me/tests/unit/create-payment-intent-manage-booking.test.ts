/**
 * Manage page posts holdId (not pending bookingIds) to create-payment-intent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const HOLD_ID = 2608
const TIMESLOT_ID = 18140
const TENANT_ID = 3
const USER_ID = 99
const USER = { id: USER_ID, email: 'user@example.com', name: 'Test User' }

const {
  mockPayload,
  mockGetActiveCheckoutHold,
  mockComputeRemainingCapacityWithHolds,
} = vi.hoisted(() => ({
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    auth: vi.fn(),
  },
  mockGetActiveCheckoutHold: vi.fn(),
  mockComputeRemainingCapacityWithHolds: vi.fn().mockResolvedValue(10),
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  getCurrentUser: vi.fn(),
  resolveTenantSlugOrId: vi.fn().mockReturnValue(null),
  resolveTenantForConnect: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: vi.fn().mockReturnValue(false),
}))

vi.mock('@repo/bookings-payments', () => ({
  ensureStripeCustomerIdForAccount: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_test' }),
  getActiveCheckoutHold: mockGetActiveCheckoutHold,
  computeRemainingCapacityWithHolds: mockComputeRemainingCapacityWithHolds,
  fulfillCheckoutHold: vi.fn(),
  CHECKOUT_HOLD_COLLECTION_SLUG: 'booking-checkout-holds',
}))

vi.mock('@repo/shared-utils', () => ({
  formatAmountForStripe: vi.fn().mockImplementation((price: number) => Math.round(price * 100)),
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantPaymentIntent: vi.fn().mockResolvedValue({ client_secret: 'pi_live_secret' }),
}))

vi.mock('@/lib/booking/payment-intent', () => ({
  formatCapacityError: (remaining: number, requested: number) =>
    remaining === 0
      ? 'This timeslot is fully booked.'
      : `Only ${remaining} spot${remaining !== 1 ? 's' : ''} available. You requested ${requested}.`,
}))

vi.mock('@/lib/api/request-utils', () => ({
  coerceMetadata: vi.fn().mockImplementation((m: unknown) => m as Record<string, string>),
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { POST } from '@/app/api/stripe/connect/create-payment-intent/route'

function makeTimeslot() {
  return {
    id: TIMESLOT_ID,
    tenant: TENANT_ID,
    remainingCapacity: 10,
    eventType: {
      paymentMethods: {
        allowedDropIn: { id: 1, maxBookingsPerTimeslot: null },
      },
    },
  }
}

function makeTenant() {
  return {
    id: TENANT_ID,
    stripeConnectAccountId: 'acct_live_manage_booking_test',
    stripeConnectOnboardingStatus: 'active',
  }
}

function makeManagePageRequest() {
  return {
    json: () =>
      Promise.resolve({
        price: 15,
        metadata: {
          holdId: String(HOLD_ID),
          timeslotId: String(TIMESLOT_ID),
          quantity: '1',
        },
      }),
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams() },
    cookies: { get: () => undefined },
  } as unknown as import('next/server').NextRequest
}

describe('POST /api/stripe/connect/create-payment-intent — manage page hold', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    mockGetActiveCheckoutHold.mockResolvedValue({
      id: HOLD_ID,
      quantity: 1,
      expiresAt: new Date().toISOString(),
    })
    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') return Promise.resolve(makeTimeslot())
      if (collection === 'tenants') return Promise.resolve(makeTenant())
      return Promise.resolve(null)
    })
  })

  it('returns 200 for manage-page payload with holdId', async () => {
    const res = await POST(makeManagePageRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.error).toBeUndefined()
    expect(typeof body.clientSecret).toBe('string')
  })

  it('uses holdId from metadata without calling getActiveCheckoutHold', async () => {
    await POST(makeManagePageRequest())

    expect(mockGetActiveCheckoutHold).not.toHaveBeenCalled()
  })

  it('checks remaining capacity via computeRemainingCapacityWithHolds', async () => {
    await POST(makeManagePageRequest())

    expect(mockComputeRemainingCapacityWithHolds).toHaveBeenCalled()
  })
})

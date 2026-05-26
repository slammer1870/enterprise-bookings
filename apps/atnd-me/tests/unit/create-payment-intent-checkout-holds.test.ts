/**
 * create-payment-intent uses holdId, not pending bookings.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockGetActiveCheckoutHold,
  mockReservePendingBookings,
  mockComputeRemainingCapacityWithHolds,
  mockPayload,
} = vi.hoisted(() => ({
  mockGetActiveCheckoutHold: vi.fn(),
  mockReservePendingBookings: vi.fn(),
  mockComputeRemainingCapacityWithHolds: vi.fn(),
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
  },
}))

vi.mock('@/lib/booking/payment-intent', () => ({
  validateBookingIdsFromMetadata: vi.fn().mockResolvedValue([]),
  reservePendingBookings: mockReservePendingBookings,
  formatCapacityError: vi.fn(),
  computeRemainingCapacityForTimeslot: vi.fn().mockResolvedValue(5),
}))

vi.mock('@repo/bookings-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/bookings-payments')>()
  return {
    ...actual,
    ensureStripeCustomerIdForAccount: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_test' }),
    getActiveCheckoutHold: mockGetActiveCheckoutHold,
    computeRemainingCapacityWithHolds: mockComputeRemainingCapacityWithHolds,
    fulfillCheckoutHold: vi.fn(),
  }
})

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 5, email: 'u@test.com' }),
  resolveTenantSlugOrId: vi.fn().mockReturnValue(null),
  resolveTenantForConnect: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantPaymentIntent: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/webhook/confirm-bookings', () => ({
  confirmBookingsFromPaymentIntent: vi.fn(),
}))

vi.mock('@/lib/api/request-utils', () => ({
  coerceMetadata: vi.fn().mockImplementation((m: unknown) => m as Record<string, string>),
}))

vi.mock('@repo/shared-utils', () => ({
  formatAmountForStripe: vi.fn().mockImplementation((price: number) => Math.round(price * 100)),
}))

import { POST } from '@/app/api/stripe/connect/create-payment-intent/route'

describe('POST create-payment-intent — checkout holds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveCheckoutHold.mockResolvedValue({
      id: 99,
      quantity: 1,
      expiresAt: new Date().toISOString(),
    })
    mockComputeRemainingCapacityWithHolds.mockResolvedValue(5)
    mockPayload.findByID.mockResolvedValue({
      id: 10,
      tenant: 3,
      remainingCapacity: 5,
      eventType: { paymentMethods: { allowedDropIn: { maxBookingsPerTimeslot: null } } },
    })
    mockPayload.find.mockResolvedValue({ totalDocs: 0, docs: [] })
    process.env.ENABLE_TEST_WEBHOOKS = 'true'
  })

  afterEach(() => {
    delete process.env.ENABLE_TEST_WEBHOOKS
  })

  it('does not call reservePendingBookings', async () => {
    const req = new Request('http://localhost/api/stripe/connect/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: 10,
        metadata: { timeslotId: '10', quantity: '1' },
      }),
    })

    const res = await POST(req as never)
    expect(res.status).toBe(200)
    expect(mockReservePendingBookings).not.toHaveBeenCalled()
    expect(mockGetActiveCheckoutHold).toHaveBeenCalled()
  })

  it('returns 400 when no active hold exists', async () => {
    mockGetActiveCheckoutHold.mockResolvedValue(null)

    const req = new Request('http://localhost/api/stripe/connect/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: 10,
        metadata: { timeslotId: '10', quantity: '1' },
      }),
    })

    const res = await POST(req as never)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/hold required/i)
  })
})

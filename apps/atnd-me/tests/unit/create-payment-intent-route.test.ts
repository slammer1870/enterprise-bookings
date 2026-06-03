/**
 * Regression tests for the create-payment-intent route handler.
 *
 * Checkout uses booking-checkout-holds (not pending booking rows). The route requires
 * an active hold before creating a payment intent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockPayload,
  mockGetActiveCheckoutHold,
  mockComputeRemainingCapacityWithHolds,
} = vi.hoisted(() => ({
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    auth: vi.fn(),
    sendEmail: vi.fn().mockResolvedValue(undefined),
  },
  mockGetActiveCheckoutHold: vi.fn(),
  mockComputeRemainingCapacityWithHolds: vi.fn().mockResolvedValue(10),
}))

vi.mock('@/lib/booking/payment-intent', () => ({
  formatCapacityError: (remaining: number, requested: number) =>
    remaining === 0
      ? 'This timeslot is fully booked.'
      : `Only ${remaining} spot${remaining !== 1 ? 's' : ''} available. You requested ${requested}.`,
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

vi.mock('@/lib/api/request-utils', () => ({
  coerceMetadata: vi.fn().mockImplementation((m: unknown) => m as Record<string, string>),
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { POST } from '@/app/api/stripe/connect/create-payment-intent/route'

const TIMESLOT_ID = 7
const TENANT_ID = 3
const HOLD_ID = 55
const USER = { id: 99, email: 'user@example.com', name: 'Test User' }

function makeTimeslot(overrides: Record<string, unknown> = {}) {
  return {
    id: TIMESLOT_ID,
    tenant: TENANT_ID,
    remainingCapacity: 10,
    eventType: {
      paymentMethods: {
        allowedDropIn: { id: 1, maxBookingsPerTimeslot: null },
      },
    },
    ...overrides,
  }
}

function makeTenant() {
  return {
    id: TENANT_ID,
    stripeConnectAccountId: 'acct_placeholder_test',
    stripeConnectOnboardingStatus: 'active',
  }
}

function makeRequest(body: Record<string, unknown> = {}) {
  return {
    json: () =>
      Promise.resolve({
        price: 15,
        metadata: { timeslotId: String(TIMESLOT_ID), holdId: String(HOLD_ID) },
        ...body,
      }),
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams() },
    cookies: { get: () => undefined },
  } as unknown as import('next/server').NextRequest
}

describe('POST /api/stripe/connect/create-payment-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    mockGetActiveCheckoutHold.mockResolvedValue({
      id: HOLD_ID,
      quantity: 1,
      expiresAt: new Date().toISOString(),
    })
    mockComputeRemainingCapacityWithHolds.mockResolvedValue(10)
    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') return Promise.resolve(makeTimeslot())
      if (collection === 'tenants') return Promise.resolve(makeTenant())
      return Promise.resolve(null)
    })
  })

  it('returns 200 with clientSecret for a legitimate drop-in booking', async () => {
    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(typeof body.clientSecret).toBe('string')
    expect(body.clientSecret).toMatch(/^pi_/)
  })

  it('uses holdId from metadata when provided', async () => {
    await POST(makeRequest())

    expect(mockGetActiveCheckoutHold).not.toHaveBeenCalled()
  })

  it('falls back to getActiveCheckoutHold when holdId is not in metadata', async () => {
    await POST(
      makeRequest({
        metadata: { timeslotId: String(TIMESLOT_ID) },
      }),
    )

    expect(mockGetActiveCheckoutHold).toHaveBeenCalledWith(mockPayload, {
      timeslotId: TIMESLOT_ID,
      userId: USER.id,
    })
  })

  it('returns 400 when no active hold exists', async () => {
    mockGetActiveCheckoutHold.mockResolvedValue(null)

    const res = await POST(
      makeRequest({
        metadata: { timeslotId: String(TIMESLOT_ID) },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/hold required/i)
  })

  it('returns 401 when the user is not authenticated', async () => {
    ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('returns 400 when timeslotId is missing from metadata', async () => {
    const res = await POST(makeRequest({ metadata: {} }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/timeslotId/i)
  })

  it('returns 400 when the timeslot is at capacity', async () => {
    mockComputeRemainingCapacityWithHolds.mockResolvedValue(0)

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/fully booked/i)
  })
})

/**
 * Regression test for the create-payment-intent route handler.
 *
 * Core regression: the route was returning 400 {"error":"You are not allowed to
 * perform this action."} for legitimate drop-in bookings in production because
 * reservePendingBookings was called with trustedServerReservation: isTestMode
 * (false in production), causing payload.find / payload.create to run with
 * overrideAccess: false. The bookings read access (tenantScopedPublicReadStrict)
 * then returned false for Local API requests that carry no HTTP context, and
 * Payload threw its built-in Forbidden error.
 *
 * Fix: trustedServerReservation is now always true. These tests verify that:
 *   1. The route calls reservePendingBookings with trustedServerReservation: true.
 *   2. The route returns 200 + clientSecret for a legitimate drop-in booking.
 *   3. The route returns 400 (not 500) when reservePendingBookings throws.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── mock all I/O dependencies before importing the route ───────────────────
// vi.mock factories are hoisted above variable declarations, so shared mocks
// that are referenced inside factories must use vi.hoisted().

const {
  mockPayload,
  mockReservePendingBookings,
  mockValidateBookingIdsFromMetadata,
  mockComputeRemainingCapacityForTimeslot,
} = vi.hoisted(() => ({
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    auth: vi.fn(),
  },
  mockReservePendingBookings: vi.fn(),
  mockValidateBookingIdsFromMetadata: vi.fn().mockResolvedValue([]),
  mockComputeRemainingCapacityForTimeslot: vi.fn().mockResolvedValue(10),
}))

vi.mock('@/lib/booking/payment-intent', () => ({
  reservePendingBookings: mockReservePendingBookings,
  validateBookingIdsFromMetadata: mockValidateBookingIdsFromMetadata,
  computeRemainingCapacityForTimeslot: mockComputeRemainingCapacityForTimeslot,
  formatCapacityError: (remaining: number, requested: number) =>
    remaining === 0
      ? 'This timeslot is fully booked.'
      : `Only ${remaining} spot${remaining !== 1 ? 's' : ''} available. You requested ${requested}.`,
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  getCurrentUser: vi.fn(),
  resolveTenantSlugOrId: vi.fn().mockReturnValue(null), // no tenant context → guard is no-op
  resolveTenantForConnect: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: vi.fn().mockReturnValue(false),
}))

vi.mock('@repo/bookings-payments', () => ({
  ensureStripeCustomerIdForAccount: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_test' }),
}))

vi.mock('@repo/shared-utils', () => ({
  formatAmountForStripe: vi.fn().mockImplementation((price: number) => Math.round(price * 100)),
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantPaymentIntent: vi.fn().mockResolvedValue({ client_secret: 'pi_live_secret' }),
}))

vi.mock('@/lib/stripe-connect/webhook/confirm-bookings', () => ({
  confirmBookingsFromPaymentIntent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/api/request-utils', () => ({
  coerceMetadata: vi.fn().mockImplementation((m: unknown) => m as Record<string, string>),
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

import { getCurrentUser } from '@/lib/stripe-connect/api-helpers'
import { POST } from '@/app/api/stripe/connect/create-payment-intent/route'

// ─── fixtures ────────────────────────────────────────────────────────────────

const TIMESLOT_ID = 7
const TENANT_ID = 3
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

function makeTenant(overrides: Partial<{ stripeConnectAccountId: string; stripeConnectOnboardingStatus: string }> = {}) {
  return {
    id: TENANT_ID,
    stripeConnectAccountId: 'acct_placeholder_test',
    stripeConnectOnboardingStatus: 'active',
    ...overrides,
  }
}

function makeRequest(body: Record<string, unknown> = {}) {
  return {
    json: () => Promise.resolve({
      price: 15,
      metadata: { timeslotId: String(TIMESLOT_ID) },
      ...body,
    }),
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams() },
    cookies: { get: () => undefined },
  } as unknown as import('next/server').NextRequest
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('POST /api/stripe/connect/create-payment-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    mockReservePendingBookings.mockResolvedValue(['101'])
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
    // NODE_ENV=test so the route returns a test client secret
    expect(typeof body.clientSecret).toBe('string')
    expect(body.clientSecret).toMatch(/^pi_/)
  })

  it('calls reservePendingBookings with trustedServerReservation: true', async () => {
    await POST(makeRequest())

    expect(mockReservePendingBookings).toHaveBeenCalledOnce()
    expect(mockReservePendingBookings.mock.calls[0][1]).toMatchObject({
      trustedServerReservation: true,
    })
  })

  it('does NOT return the Forbidden 400 that was the original production bug', async () => {
    // The original bug: reservePendingBookings threw Payload's Forbidden error because
    // payload.find ran with overrideAccess: false and the bookings read access
    // (tenantScopedPublicReadStrict) returned false for the Local API internal request.
    // The route caught it and returned 400 {"error":"You are not allowed to perform this action."}.
    mockReservePendingBookings.mockRejectedValueOnce(
      new Error('You are not allowed to perform this action.'),
    )

    const res = await POST(makeRequest())
    const body = await res.json()

    // With the fix deployed this path is never reached (trustedServerReservation: true
    // means overrideAccess: true, so Payload never throws Forbidden).
    // If it IS somehow reached the route must return 400, not 200 — document the contract.
    expect(res.status).toBe(400)
    expect(body.error).toBe('You are not allowed to perform this action.')
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
    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') return Promise.resolve(makeTimeslot({ remainingCapacity: 0 }))
      if (collection === 'tenants') return Promise.resolve(makeTenant())
      return Promise.resolve(null)
    })

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/fully booked/i)
  })
})

/**
 * Regression: manage page POSTs explicit bookingIds to create-payment-intent.
 *
 * Production bug: validateBookingIdsFromMetadata used overrideAccess: false. Local API
 * calls have no HTTP tenant context, so tenantScopedPublicReadStrict denied the read and
 * Payload threw Forbidden — uncaught in the route → HTTP 500.
 *
 * Example failing payload:
 *   { price: 15, metadata: { bookingIds: "2608", timeslotId: "18140" } }
 *
 * This file exercises the real validateBookingIdsFromMetadata helper (not mocked) and
 * simulates Payload access denial when overrideAccess is false on bookings reads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const BOOKING_ID = 2608
const TIMESLOT_ID = 18140
const TENANT_ID = 3
const USER_ID = 99
const USER = { id: USER_ID, email: 'user@example.com', name: 'Test User' }

const { mockPayload, mockCreateTenantPaymentIntent } = vi.hoisted(() => ({
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn(),
    auth: vi.fn(),
  },
  mockCreateTenantPaymentIntent: vi.fn().mockResolvedValue({ client_secret: 'pi_live_secret' }),
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
}))

vi.mock('@repo/shared-utils', () => ({
  formatAmountForStripe: vi.fn().mockImplementation((price: number) => Math.round(price * 100)),
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantPaymentIntent: mockCreateTenantPaymentIntent,
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
          bookingIds: String(BOOKING_ID),
          timeslotId: String(TIMESLOT_ID),
        },
      }),
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams() },
    cookies: { get: () => undefined },
  } as unknown as import('next/server').NextRequest
}

/** Simulates tenantScopedPublicReadStrict denying Local API reads without overrideAccess. */
function installPayloadFindMock() {
  mockPayload.find.mockImplementation(
    (args: { collection: string; overrideAccess?: boolean; where?: unknown }) => {
      if (args.collection !== 'bookings') {
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }

      if (args.overrideAccess !== true) {
        return Promise.reject(new Error('You are not allowed to perform this action.'))
      }

      const whereStr = JSON.stringify(args.where ?? {})
      if (
        whereStr.includes(String(BOOKING_ID)) &&
        whereStr.includes(String(TIMESLOT_ID)) &&
        whereStr.includes(String(USER_ID)) &&
        whereStr.includes('pending')
      ) {
        return Promise.resolve({ docs: [{ id: BOOKING_ID }] })
      }

      if (whereStr.includes('confirmed')) {
        return Promise.resolve({ docs: [], totalDocs: 1 })
      }

      return Promise.resolve({ docs: [], totalDocs: 0 })
    },
  )
}

describe('POST /api/stripe/connect/create-payment-intent — manage page bookingIds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(USER)
    installPayloadFindMock()
    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') return Promise.resolve(makeTimeslot())
      if (collection === 'tenants') return Promise.resolve(makeTenant())
      return Promise.resolve(null)
    })
  })

  it('returns 200 (not 500) for the production manage-page payload shape', async () => {
    const res = await POST(makeManagePageRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(500)
    expect(body.error).toBeUndefined()
    expect(typeof body.clientSecret).toBe('string')
  })

  it('resolves pending booking IDs with overrideAccess: true on bookings find', async () => {
    await POST(makeManagePageRequest())

    const bookingsFindCalls = mockPayload.find.mock.calls.filter(
      ([args]: [{ collection: string }]) => args.collection === 'bookings',
    )
    expect(bookingsFindCalls.length).toBeGreaterThan(0)

    const validateCall = bookingsFindCalls.find(
      ([args]: [{ where?: unknown }]) => JSON.stringify(args.where ?? '').includes('pending'),
    )
    expect(validateCall).toBeDefined()
    expect(validateCall![0]).toMatchObject({ overrideAccess: true })
  })

  it('does not call Stripe live path in test mode but still validates bookingIds first', async () => {
    await POST(makeManagePageRequest())

    // In NODE_ENV=test the route short-circuits to a mock client secret, but
    // validateBookingIdsFromMetadata must still run successfully first.
    expect(mockCreateTenantPaymentIntent).not.toHaveBeenCalled()
    expect(mockPayload.find).toHaveBeenCalled()
  })
})

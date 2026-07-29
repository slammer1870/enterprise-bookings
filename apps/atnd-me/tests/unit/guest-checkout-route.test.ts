/**
 * Guest event checkout: create/find guest user, reserve hold, return payment client secret.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockEnsureGuestUser,
  mockUpsertCheckoutHold,
  mockComputeRemainingCapacityWithHolds,
  mockCreateTenantPaymentIntent,
  mockEnsureStripeCustomerIdForAccount,
  mockPayload,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockEnsureGuestUser: vi.fn(),
  mockUpsertCheckoutHold: vi.fn(),
  mockComputeRemainingCapacityWithHolds: vi.fn(),
  mockCreateTenantPaymentIntent: vi.fn(),
  mockEnsureStripeCustomerIdForAccount: vi.fn(),
  mockCheckRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  mockPayload: {
    findByID: vi.fn(),
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
  },
}))

vi.mock('@/lib/booking/ensureGuestUser', () => ({
  ensureGuestUser: mockEnsureGuestUser,
}))

vi.mock('@repo/bookings-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/bookings-payments')>()
  return {
    ...actual,
    upsertCheckoutHold: mockUpsertCheckoutHold,
    computeRemainingCapacityWithHolds: mockComputeRemainingCapacityWithHolds,
    ensureStripeCustomerIdForAccount: mockEnsureStripeCustomerIdForAccount,
  }
})

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  resolveTenantSlugOrId: vi.fn().mockReturnValue(null),
  resolveTenantForConnect: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: vi.fn().mockReturnValue(true),
}))

vi.mock('@/lib/stripe-connect/charges', () => ({
  createTenantPaymentIntent: mockCreateTenantPaymentIntent,
}))

vi.mock('@/lib/api/request-utils', () => ({
  coerceMetadata: vi.fn().mockImplementation((m: unknown) => m as Record<string, string>),
}))

vi.mock('@repo/shared-utils', () => ({
  formatAmountForStripe: vi.fn().mockImplementation((price: number) => Math.round(price * 100)),
}))

vi.mock('@/lib/onboarding/rateLimit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

import { POST } from '@/app/api/events/guest-checkout/route'

const TIMESLOT_ID = 28093
const TENANT_ID = 4
const HOLD_ID = 88

function makeTimeslot(overrides: Record<string, unknown> = {}) {
  return {
    id: TIMESLOT_ID,
    active: true,
    tenant: TENANT_ID,
    eventType: {
      paymentMethods: {
        allowedDropIn: { id: 1, price: 25, maxBookingsPerTimeslot: 4 },
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
        price: 25,
        guestName: 'Sam Guest',
        guestEmail: 'sam.guest@example.com',
        metadata: {
          timeslotId: String(TIMESLOT_ID),
          quantity: '1',
          guestName: 'Sam Guest',
          guestEmail: 'sam.guest@example.com',
        },
        ...body,
      }),
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  } as unknown as import('next/server').NextRequest
}

describe('POST /api/events/guest-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockEnsureGuestUser.mockResolvedValue({
      userId: 101,
      created: true,
      email: 'sam.guest@example.com',
      name: 'Sam Guest',
    })
    mockUpsertCheckoutHold.mockResolvedValue({ holdId: HOLD_ID, quantity: 1 })
    mockComputeRemainingCapacityWithHolds.mockResolvedValue(11)
    mockEnsureStripeCustomerIdForAccount.mockResolvedValue({ stripeCustomerId: 'cus_guest' })
    mockCreateTenantPaymentIntent.mockResolvedValue({ client_secret: 'pi_secret_live' })
    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') return Promise.resolve(makeTimeslot())
      if (collection === 'tenants') return Promise.resolve(makeTenant())
      return Promise.resolve(null)
    })
    mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })
  })

  it('returns a test clientSecret and holdId in test mode', async () => {
    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.holdId).toBe(HOLD_ID)
    expect(typeof body.clientSecret).toBe('string')
    expect(body.clientSecret).toMatch(/^pi_test_.*_secret_test$/)
    expect(mockEnsureGuestUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sam.guest@example.com',
        name: 'Sam Guest',
        tenantId: TENANT_ID,
      }),
    )
    expect(mockUpsertCheckoutHold).toHaveBeenCalledWith(
      mockPayload,
      expect.objectContaining({
        timeslotId: TIMESLOT_ID,
        userId: 101,
        tenantId: TENANT_ID,
        quantity: 1,
      }),
    )
    expect(mockCreateTenantPaymentIntent).not.toHaveBeenCalled()
  })

  it('surfaces ensureGuestUser validation errors (e.g. tenants roles)', async () => {
    mockEnsureGuestUser.mockRejectedValue(
      new Error('The following fields are invalid: Tenants 1 > Roles, Tenants 2 > Roles'),
    )

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/Tenants .* Roles/i)
    expect(mockUpsertCheckoutHold).not.toHaveBeenCalled()
  })

  it('returns 400 when checkout hold capacity check fails', async () => {
    mockUpsertCheckoutHold.mockRejectedValue(new Error('This timeslot is fully booked.'))

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/fully booked/i)
  })

  it('returns 400 when requested quantity exceeds remaining capacity', async () => {
    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') {
        return Promise.resolve(
          makeTimeslot({
            eventType: {
              paymentMethods: {
                allowedDropIn: { id: 1, price: 25, maxBookingsPerTimeslot: null },
              },
            },
          }),
        )
      }
      if (collection === 'tenants') return Promise.resolve(makeTenant())
      return Promise.resolve(null)
    })
    mockUpsertCheckoutHold.mockResolvedValue({ holdId: HOLD_ID, quantity: 1 })
    mockComputeRemainingCapacityWithHolds.mockResolvedValue(2)

    const res = await POST(
      makeRequest({
        metadata: {
          timeslotId: String(TIMESLOT_ID),
          quantity: '5',
          guestName: 'Sam Guest',
          guestEmail: 'sam.guest@example.com',
        },
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toMatch(/spot|available|booked/i)
  })

  it('returns 400 when guest name or email is missing', async () => {
    const res = await POST(
      makeRequest({
        guestName: '',
        guestEmail: '',
        metadata: { timeslotId: String(TIMESLOT_ID), quantity: '1' },
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/name/i)
  })

  it('returns 400 for incomplete emails that would otherwise create orphan holds', async () => {
    const res = await POST(
      makeRequest({
        guestName: 'Sam',
        guestEmail: 'sam@',
        metadata: {
          timeslotId: String(TIMESLOT_ID),
          quantity: '1',
          guestName: 'Sam',
          guestEmail: 'sam@',
        },
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/valid email/i)
    expect(mockEnsureGuestUser).not.toHaveBeenCalled()
    expect(mockUpsertCheckoutHold).not.toHaveBeenCalled()
  })

  it('returns 400 when event has no drop-in payment method', async () => {
    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') {
        return Promise.resolve(
          makeTimeslot({
            eventType: { paymentMethods: { allowedDropIn: null } },
          }),
        )
      }
      return Promise.resolve(null)
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/drop-in/i)
  })

  it('creates a live payment intent when not in test mode', async () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevEnableTestWebhooks = process.env.ENABLE_TEST_WEBHOOKS
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ENABLE_TEST_WEBHOOKS', '')

    const { isStripeTestAccount } = await import('@/lib/stripe-connect/test-accounts')
    ;(isStripeTestAccount as ReturnType<typeof vi.fn>).mockReturnValue(false)

    mockPayload.findByID.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'timeslots') return Promise.resolve(makeTimeslot())
      if (collection === 'tenants') {
        return Promise.resolve({
          id: TENANT_ID,
          stripeConnectAccountId: 'acct_1RealConnectAccount',
          stripeConnectOnboardingStatus: 'active',
        })
      }
      return Promise.resolve(null)
    })

    try {
      const res = await POST(makeRequest())
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.clientSecret).toBe('pi_secret_live')
      expect(mockCreateTenantPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          classPriceAmount: 2500,
          productType: 'drop-in',
          metadata: expect.objectContaining({
            timeslotId: String(TIMESLOT_ID),
            userId: '101',
            holdId: String(HOLD_ID),
            guestCheckout: 'true',
          }),
        }),
      )
    } finally {
      vi.stubEnv('NODE_ENV', prevNodeEnv ?? 'test')
      if (prevEnableTestWebhooks === undefined) {
        vi.unstubAllEnvs()
      } else {
        vi.stubEnv('ENABLE_TEST_WEBHOOKS', prevEnableTestWebhooks)
      }
    }
  })
})

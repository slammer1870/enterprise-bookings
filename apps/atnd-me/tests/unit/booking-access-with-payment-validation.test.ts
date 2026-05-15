/**
 * Regression tests for bookingCreateAccessWithPaymentValidation.
 *
 * Bug (original): When called from the Local API (e.g. reservePendingBookings in
 * create-payment-intent), the internal request has no HTTP headers or cookies,
 * so tenantScopedPublicReadStrict cannot resolve the tenant and returns false.
 * This caused the timeslot findByID inside the access function to throw Payload's
 * Forbidden error ("You are not allowed to perform this action."), which propagated
 * to the client as an "invalid payment request" when selecting drop-in.
 * Fix: timeslot fetch uses overrideAccess: true.
 *
 * Bug (security): If the timeslot lookup returns null (e.g. deleted timeslot, ID
 * enumeration), the access function was returning true — bypassing payment checks.
 * Fix: !timeslot now returns false.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bookingCreateAccessWithPaymentValidation } from '@/access/bookingAccess'

vi.mock('@repo/bookings-plugin', () => ({
  createBookingAccess: () => ({
    bookingCreateAccess: vi.fn().mockResolvedValue(true),
    bookingUpdateAccess: vi.fn().mockResolvedValue(true),
    isAdminOrOwner: vi.fn().mockReturnValue(true),
  }),
}))

vi.mock('@repo/bookings-payments', () => ({
  checkClassPass: vi.fn().mockResolvedValue({ valid: false }),
}))

vi.mock('@/utilities/getTenantFromTimeslot', () => ({
  getTenantFromTimeslot: vi.fn().mockResolvedValue(42),
}))

const TIMESLOT_ID = 7

function makeDropInEventType() {
  return {
    paymentMethods: {
      allowedDropIn: { id: 1, maxBookingsPerTimeslot: 1 },
      allowedPlans: null,
      allowedClassPasses: null,
    },
  }
}

function makeTimeslot(overrides: Record<string, unknown> = {}) {
  return {
    id: TIMESLOT_ID,
    tenant: 42,
    eventType: makeDropInEventType(),
    startTime: new Date(Date.now() + 3_600_000).toISOString(),
    lockOutTime: 0,
    ...overrides,
  }
}

function makeTenant(overrides: Partial<{ stripeConnectAccountId: string; stripeConnectOnboardingStatus: string }> = {}) {
  return {
    id: 42,
    stripeConnectAccountId: 'acct_live_123',
    stripeConnectOnboardingStatus: 'active',
    ...overrides,
  }
}

/**
 * Build a mock req simulating a Local API call:
 * no HTTP cookies, no tenant context — replicates what Payload passes when
 * payload.create({ user, overrideAccess: false }) is called from the server.
 */
function makeLocalApiReq(findByIDImpl?: (args: { collection: string; id: unknown; overrideAccess?: boolean }) => Promise<unknown>) {
  const defaultImpl = async ({ collection }: { collection: string }) => {
    if (collection === 'timeslots') return makeTimeslot()
    if (collection === 'tenants') return makeTenant()
    return null
  }

  return {
    user: { id: 99, role: ['viewer'], tenants: [] },
    context: {},  // no tenant — Local API has no HTTP cookies/headers
    cookies: { get: () => undefined },
    headers: new Headers(),
    payload: {
      findByID: vi.fn(findByIDImpl ?? defaultImpl),
    },
    data: {
      timeslot: TIMESLOT_ID,
      user: 99,
      status: 'pending',
    },
  }
}

describe('bookingCreateAccessWithPaymentValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the timeslot with overrideAccess: true so it does not fail for Local API requests without tenant context', async () => {
    const req = makeLocalApiReq()

    await bookingCreateAccessWithPaymentValidation({
      req: req as never,
      data: { timeslot: TIMESLOT_ID, user: 99, status: 'pending' },
    } as never)

    const timeslotCall = (req.payload.findByID as ReturnType<typeof vi.fn>).mock.calls.find(
      ([args]: [{ collection: string }]) => args.collection === 'timeslots',
    )
    expect(timeslotCall).toBeDefined()
    expect(timeslotCall![0]).toMatchObject({ overrideAccess: true })
  })

  it('returns true for a regular user booking a drop-in class with an active Stripe Connect tenant', async () => {
    const req = makeLocalApiReq()

    const result = await bookingCreateAccessWithPaymentValidation({
      req: req as never,
      data: { timeslot: TIMESLOT_ID, user: 99, status: 'pending' },
    } as never)

    expect(result).toBe(true)
  })

  it('returns false when the tenant does not have active Stripe Connect (drop-in requires payment)', async () => {
    const req = makeLocalApiReq(async ({ collection }) => {
      if (collection === 'timeslots') return makeTimeslot()
      if (collection === 'tenants') return makeTenant({ stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' })
      return null
    })

    const result = await bookingCreateAccessWithPaymentValidation({
      req: req as never,
      data: { timeslot: TIMESLOT_ID, user: 99, status: 'pending' },
    } as never)

    expect(result).toBe(false)
  })

  it('returns true for a free class (no payment methods configured) even without Stripe Connect', async () => {
    const req = makeLocalApiReq(async ({ collection }) => {
      if (collection === 'timeslots')
        return makeTimeslot({ eventType: { paymentMethods: {} } })
      if (collection === 'tenants')
        return makeTenant({ stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' })
      return null
    })

    const result = await bookingCreateAccessWithPaymentValidation({
      req: req as never,
      data: { timeslot: TIMESLOT_ID, user: 99, status: 'pending' },
    } as never)

    expect(result).toBe(true)
  })

  it('returns false when the timeslot is not found — prevents payment bypass via deleted/invalid IDs', async () => {
    const req = makeLocalApiReq(async () => null)

    const result = await bookingCreateAccessWithPaymentValidation({
      req: req as never,
      data: { timeslot: TIMESLOT_ID, user: 99, status: 'pending' },
    } as never)

    // Must be false: if we cannot verify payment requirements the booking should be denied,
    // not allowed. Returning true here would let a user bypass Stripe Connect checks by
    // supplying a timeslot ID that no longer exists.
    expect(result).toBe(false)
  })
})

/**
 * TDD: fulfillCheckoutHold — create confirmed bookings on payment success.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fulfillCheckoutHold } from '../src/checkout-holds/fulfill'
import { HOLD_FULFILLMENT_GRACE_MS, HOLD_TTL_MS } from '../src/checkout-holds/constants'

const HOLD_ID = 50
const TIMESLOT_ID = 10
const USER_ID = 5
const TENANT_ID = 3
const PI_ID = 'pi_test_123'
const PLACES = 10

function iso(ms: number) {
  return new Date(ms).toISOString()
}

describe('fulfillCheckoutHold', () => {
  let now: number
  let hold: Record<string, unknown>
  let confirmedCount: number
  let otherHoldQty: number
  let createdBookings: Record<string, unknown>[]

  beforeEach(() => {
    now = Date.parse('2026-05-23T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)
    confirmedCount = 0
    otherHoldQty = 0
    createdBookings = []
    hold = {
      id: HOLD_ID,
      user: USER_ID,
      timeslot: TIMESLOT_ID,
      tenant: TENANT_ID,
      quantity: 2,
      expiresAt: iso(now + HOLD_TTL_MS),
      firstUpsertedAt: iso(now),
      status: 'active',
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makePayload() {
    return {
      findByID: vi.fn().mockImplementation(({ collection, id }: { collection: string; id: number }) => {
        if (collection === 'booking-checkout-holds' && id === HOLD_ID) {
          return Promise.resolve({ ...hold })
        }
        if (collection === 'timeslots') {
          return Promise.resolve({ id: TIMESLOT_ID, eventType: { places: PLACES } })
        }
        return Promise.reject(new Error('Not found'))
      }),
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'bookings') {
          return Promise.resolve({ docs: [], totalDocs: confirmedCount })
        }
        if (collection === 'booking-checkout-holds') {
          return Promise.resolve({ docs: [], totalDocs: otherHoldQty })
        }
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      create: vi.fn().mockImplementation(({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        const doc = { id: 100 + createdBookings.length, ...data }
        if (collection === 'bookings') createdBookings.push(doc)
        return Promise.resolve(doc)
      }),
      update: vi.fn().mockImplementation(({ id, data }: { id: number; data: Record<string, unknown> }) => {
        if (id === HOLD_ID) hold = { ...hold, ...data }
        return Promise.resolve({ id, ...data })
      }),
      refundPaymentIntent: vi.fn(),
    }
  }

  it('creates confirmed bookings and marks hold consumed for active hold', async () => {
    const payload = makePayload()
    const onRefund = vi.fn()

    const result = await fulfillCheckoutHold(payload as never, {
      holdId: HOLD_ID,
      userId: USER_ID,
      paymentIntentId: PI_ID,
      tenantId: TENANT_ID,
      refundPaymentIntent: onRefund,
    })

    expect(result.confirmedBookingIds).toHaveLength(2)
    expect(result.refunded).toBe(false)
    expect(hold.status).toBe('consumed')
    expect(createdBookings.every((b) => b.status === 'confirmed')).toBe(true)
    expect(onRefund).not.toHaveBeenCalled()
    expect(payload.create).toHaveBeenCalledTimes(4) // 2 bookings + 2 transactions
  })

  it('is idempotent when hold already consumed (no prior transactions)', async () => {
    hold.status = 'consumed'
    const payload = makePayload()

    const result = await fulfillCheckoutHold(payload as never, {
      holdId: HOLD_ID,
      userId: USER_ID,
      paymentIntentId: PI_ID,
      tenantId: TENANT_ID,
    })

    expect(result.confirmedBookingIds).toEqual([])
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('returns existing booking IDs from transactions on re-delivery after partial failure', async () => {
    hold.status = 'consumed'
    const existingTransactions = [
      { booking: 201, stripePaymentIntentId: PI_ID },
      { booking: 202, stripePaymentIntentId: PI_ID },
    ]
    const payload = makePayload()
    payload.find = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'bookings') return Promise.resolve({ docs: [], totalDocs: 0 })
      if (collection === 'booking-checkout-holds') return Promise.resolve({ docs: [], totalDocs: 0 })
      if (collection === 'transactions') return Promise.resolve({ docs: existingTransactions, totalDocs: 2 })
      return Promise.resolve({ docs: [], totalDocs: 0 })
    })

    const result = await fulfillCheckoutHold(payload as never, {
      holdId: HOLD_ID,
      userId: USER_ID,
      paymentIntentId: PI_ID,
      tenantId: TENANT_ID,
      transactionsSlug: 'transactions' as never,
    })

    expect(result.confirmedBookingIds).toEqual([201, 202])
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('marks hold consumed BEFORE creating bookings (prevents capacity double-counting)', async () => {
    const callOrder: string[] = []
    const payload = makePayload()
    payload.update = vi.fn().mockImplementation(({ id, data }: { id: number; data: Record<string, unknown> }) => {
      if (id === HOLD_ID) {
        hold = { ...hold, ...data }
        callOrder.push(`hold:${data.status}`)
      }
      return Promise.resolve({ id, ...data })
    })
    payload.create = vi.fn().mockImplementation(({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const doc = { id: 100 + createdBookings.length, ...data }
      if (collection === 'bookings') {
        createdBookings.push(doc)
        callOrder.push('booking:created')
      }
      return Promise.resolve(doc)
    })

    await fulfillCheckoutHold(payload as never, {
      holdId: HOLD_ID,
      userId: USER_ID,
      paymentIntentId: PI_ID,
      tenantId: TENANT_ID,
    })

    // Hold must be consumed before any booking is created
    const firstBookingIdx = callOrder.indexOf('booking:created')
    const holdConsumedIdx = callOrder.indexOf('hold:consumed')
    expect(holdConsumedIdx).toBeGreaterThanOrEqual(0)
    expect(firstBookingIdx).toBeGreaterThan(holdConsumedIdx)
  })

  it('grace-fulfills expired hold when capacity still available', async () => {
    hold.expiresAt = iso(now - 30_000) // 30s ago, within 60s grace
    confirmedCount = 5
    const payload = makePayload()

    const result = await fulfillCheckoutHold(payload as never, {
      holdId: HOLD_ID,
      userId: USER_ID,
      paymentIntentId: PI_ID,
      tenantId: TENANT_ID,
    })

    expect(result.confirmedBookingIds).toHaveLength(2)
    expect(hold.status).toBe('consumed')
  })

  it('refunds when expired within grace but capacity gone', async () => {
    hold.expiresAt = iso(now - 30_000)
    confirmedCount = 9
    otherHoldQty = 1
    const payload = makePayload()
    const onRefund = vi.fn().mockResolvedValue(undefined)

    // Mock countActiveHoldQuantityForTimeslot via find on holds returning 1 qty elsewhere
    payload.find = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'bookings') {
        return Promise.resolve({ docs: [], totalDocs: confirmedCount })
      }
      if (collection === 'booking-checkout-holds') {
        return Promise.resolve({
          docs: [{ quantity: 1 }],
          totalDocs: 1,
        })
      }
      return Promise.resolve({ docs: [], totalDocs: 0 })
    })

    const result = await fulfillCheckoutHold(payload as never, {
      holdId: HOLD_ID,
      userId: USER_ID,
      paymentIntentId: PI_ID,
      tenantId: TENANT_ID,
      refundPaymentIntent: onRefund,
    })

    expect(result.refunded).toBe(true)
    expect(result.confirmedBookingIds).toHaveLength(0)
    expect(onRefund).toHaveBeenCalledWith(PI_ID)
    expect(hold.status).toBe('expired')
    expect(hold.failureReason).toBe('capacity_taken')
  })

  it('fulfills when hold expired beyond grace window but capacity is still available', async () => {
    hold.expiresAt = iso(now - HOLD_FULFILLMENT_GRACE_MS - 1000)
    const payload = makePayload()
    const onRefund = vi.fn().mockResolvedValue(undefined)

    const result = await fulfillCheckoutHold(payload as never, {
      holdId: HOLD_ID,
      userId: USER_ID,
      paymentIntentId: PI_ID,
      tenantId: TENANT_ID,
      refundPaymentIntent: onRefund,
    })

    expect(result.refunded).toBe(false)
    expect(result.confirmedBookingIds).toHaveLength(2)
    expect(onRefund).not.toHaveBeenCalled()
    expect(hold.status).toBe('consumed')
  })

  it('rejects when hold belongs to different user', async () => {
    const payload = makePayload()

    await expect(
      fulfillCheckoutHold(payload as never, {
        holdId: HOLD_ID,
        userId: USER_ID + 1,
        paymentIntentId: PI_ID,
        tenantId: TENANT_ID,
      }),
    ).rejects.toThrow(/belong to this user/i)
  })
})

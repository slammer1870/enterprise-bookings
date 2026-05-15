/**
 * Regression test: reservePendingBookings must be called with trustedServerReservation: true
 * from the create-payment-intent route so that payload.find / payload.create use
 * overrideAccess: true. Without this, the bookings read access (tenantScopedPublicReadStrict)
 * returns false for Local API requests that have no HTTP cookies/headers, causing Payload to
 * throw "You are not allowed to perform this action." — surfaced to the user as an invalid
 * payment request when selecting drop-in.
 */
import { describe, it, expect, vi } from 'vitest'
import { reservePendingBookings } from '@/lib/booking/payment-intent'

const TIMESLOT_ID = 10
const USER_ID = 5
const TENANT_ID = 3

function makePayload({
  existingPending = [] as { id: number }[],
  recentlyCancelled = [] as { id: number }[],
  remainingCapacity = 5,
} = {}) {
  return {
    find: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      const statusFilter = JSON.stringify(where).includes('"cancelled"')
      return Promise.resolve({
        docs: statusFilter ? recentlyCancelled : existingPending,
        totalDocs: statusFilter ? recentlyCancelled.length : existingPending.length,
      })
    }),
    findByID: vi.fn().mockResolvedValue({ id: TIMESLOT_ID, remainingCapacity }),
    create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 99, ...data }),
    ),
  }
}

describe('reservePendingBookings — trustedServerReservation', () => {
  it('uses overrideAccess: true for all payload calls when trustedServerReservation is true', async () => {
    const payload = makePayload()

    await reservePendingBookings(payload as never, {
      timeslotId: TIMESLOT_ID,
      userId: USER_ID,
      tenantId: TENANT_ID,
      quantity: 1,
      trustedServerReservation: true,
    })

    for (const call of (payload.find as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0]).toMatchObject({ overrideAccess: true })
    }
    for (const call of (payload.create as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0]).toMatchObject({ overrideAccess: true })
    }
  })

  it('uses overrideAccess: false for all payload calls when trustedServerReservation is false', async () => {
    const payload = makePayload()

    await reservePendingBookings(payload as never, {
      timeslotId: TIMESLOT_ID,
      userId: USER_ID,
      tenantId: TENANT_ID,
      quantity: 1,
      trustedServerReservation: false,
    })

    for (const call of (payload.find as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0]).toMatchObject({ overrideAccess: false })
    }
    for (const call of (payload.create as ReturnType<typeof vi.fn>).mock.calls) {
      expect(call[0]).toMatchObject({ overrideAccess: false })
    }
  })

  it('reuses existing pending bookings instead of creating duplicates', async () => {
    const payload = makePayload({ existingPending: [{ id: 42 }] })

    const ids = await reservePendingBookings(payload as never, {
      timeslotId: TIMESLOT_ID,
      userId: USER_ID,
      tenantId: TENANT_ID,
      quantity: 1,
      trustedServerReservation: true,
    })

    expect(ids).toEqual(['42'])
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates new pending bookings when none exist', async () => {
    const payload = makePayload()

    const ids = await reservePendingBookings(payload as never, {
      timeslotId: TIMESLOT_ID,
      userId: USER_ID,
      tenantId: TENANT_ID,
      quantity: 1,
      trustedServerReservation: true,
    })

    expect(ids).toHaveLength(1)
    expect(payload.create).toHaveBeenCalledOnce()
    expect(payload.create.mock.calls[0][0].data).toMatchObject({
      user: USER_ID,
      timeslot: TIMESLOT_ID,
      tenant: TENANT_ID,
      status: 'pending',
    })
  })
})

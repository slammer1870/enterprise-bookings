/**
 * Regression: manage-booking checkout sends explicit bookingIds in payment-intent metadata.
 * validateBookingIdsFromMetadata must use overrideAccess: true so Payload does not throw
 * Forbidden when tenant context is missing from Local API calls (same class of bug as
 * reservePendingBookings / trustedServerReservation).
 */
import { describe, it, expect, vi } from 'vitest'
import { validateBookingIdsFromMetadata } from '@/lib/booking/payment-intent'

describe('validateBookingIdsFromMetadata', () => {
  it('uses overrideAccess: true when resolving client booking IDs', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 2608 }] })
    const payload = { find }

    const ids = await validateBookingIdsFromMetadata(
      payload,
      { bookingIds: '2608' },
      { timeslotId: 18140, userId: 99, user: { id: 99 } },
    )

    expect(ids).toEqual(['2608'])
    expect(find).toHaveBeenCalledOnce()
    expect(find.mock.calls[0][0]).toMatchObject({ overrideAccess: true })
  })

  it('does not throw when Payload would deny access without overrideAccess (production 500)', async () => {
    const find = vi.fn().mockImplementation((args: { overrideAccess?: boolean }) => {
      if (args.overrideAccess !== true) {
        return Promise.reject(new Error('You are not allowed to perform this action.'))
      }
      return Promise.resolve({ docs: [{ id: 2608 }] })
    })
    const payload = { find }

    await expect(
      validateBookingIdsFromMetadata(
        payload,
        { bookingIds: '2608' },
        { timeslotId: 18140, userId: 99, user: { id: 99 } },
      ),
    ).resolves.toEqual(['2608'])
  })

  it('scopes the lookup to pending bookings owned by the user for the timeslot', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ id: 2608 }] })
    const payload = { find }

    await validateBookingIdsFromMetadata(
      payload,
      { bookingIds: '2608,2609' },
      { timeslotId: 18140, userId: 99 },
    )

    const where = find.mock.calls[0][0].where
    expect(where).toMatchObject({
      and: expect.arrayContaining([
        { id: { in: [2608, 2609] } },
        { timeslot: { equals: 18140 } },
        { user: { equals: 99 } },
        { status: { equals: 'pending' } },
      ]),
    })
  })

  it('returns empty when no matching pending bookings are found', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const payload = { find }

    const ids = await validateBookingIdsFromMetadata(
      payload,
      { bookingIds: '2608' },
      { timeslotId: 18140, userId: 99 },
    )

    expect(ids).toEqual([])
  })

  it('returns empty when metadata has no bookingIds', async () => {
    const find = vi.fn()
    const payload = { find }

    const ids = await validateBookingIdsFromMetadata(
      payload,
      { timeslotId: '18140' },
      { timeslotId: 18140, userId: 99 },
    )

    expect(ids).toEqual([])
    expect(find).not.toHaveBeenCalled()
  })
})

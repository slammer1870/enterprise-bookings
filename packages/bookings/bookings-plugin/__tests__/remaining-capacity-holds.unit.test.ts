/**
 * TDD: remainingCapacity counts checkout holds instead of recent pending when configured.
 */
import { describe, it, expect, vi } from 'vitest'
import { createGetRemainingCapacity } from '../src/hooks/remaining-capacity'
import { DEFAULT_BOOKING_COLLECTION_SLUGS } from '../src/resolve-slugs'

const TIMESLOT_ID = 10
const PLACES = 8

describe('createGetRemainingCapacity — checkout-holds mode', () => {
  it('subtracts confirmed bookings and active hold quantities, not pending', async () => {
    const hook = createGetRemainingCapacity(DEFAULT_BOOKING_COLLECTION_SLUGS, {
      reservedCapacityMode: 'checkout-holds',
      checkoutHoldCollection: 'booking-checkout-holds',
    })

    const find = vi.fn().mockImplementation(({ collection, where }: { collection: string; where?: unknown }) => {
      const w = JSON.stringify(where ?? {})
      if (collection === 'bookings') {
        if (w.includes('"confirmed"')) {
          return Promise.resolve({ docs: [{ id: 1 }, { id: 2 }], totalDocs: 2 })
        }
        if (w.includes('"pending"')) {
          return Promise.resolve({ docs: [{ id: 99 }], totalDocs: 1 })
        }
      }
      if (collection === 'booking-checkout-holds') {
        return Promise.resolve({
          docs: [{ quantity: 3 }, { quantity: 1 }],
          totalDocs: 2,
        })
      }
      return Promise.resolve({ docs: [], totalDocs: 0 })
    })

    const req = {
      payload: {
        findByID: vi.fn().mockResolvedValue({ places: PLACES }),
        find,
      },
    }

    const result = await hook({
      req: req as never,
      data: { id: TIMESLOT_ID, eventType: { id: 1, places: PLACES } },
      context: {},
    } as never)

    // 8 places - 2 confirmed - 4 held = 2 (pending booking ignored)
    expect(result).toBe(2)

    const holdCalls = find.mock.calls.filter(([args]) => args.collection === 'booking-checkout-holds')
    expect(holdCalls.length).toBeGreaterThan(0)
  })
})

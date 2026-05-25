/**
 * TDD: checkout hold service — upsert, release, adjust, extend, capacity checks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  upsertCheckoutHold,
  releaseCheckoutHold,
  adjustCheckoutHoldQuantity,
  extendCheckoutHold,
  countActiveHoldQuantityForTimeslot,
  computeRemainingCapacityWithHolds,
  isHoldActive,
} from '../src/checkout-holds/service'
import { HOLD_TTL_MS, HOLD_MAX_LIFETIME_MS } from '../src/checkout-holds/constants'

const TIMESLOT_ID = 10
const USER_ID = 5
const OTHER_USER_ID = 6
const TENANT_ID = 3
const PLACES = 10

type HoldDoc = {
  id: number
  user: number
  timeslot: number
  tenant: number
  quantity: number
  expiresAt: string
  firstUpsertedAt?: string
  status: string
}

function iso(ms: number) {
  return new Date(ms).toISOString()
}

describe('checkout hold service', () => {
  let now: number
  let holds: HoldDoc[]
  let confirmedCount: number
  let nextId: number

  beforeEach(() => {
    now = Date.parse('2026-05-23T12:00:00.000Z')
    holds = []
    confirmedCount = 0
    nextId = 1
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makePayload() {
    return {
      find: vi.fn().mockImplementation(({ collection, where, limit }: { collection: string; where?: Record<string, unknown>; limit?: number }) => {
        if (collection !== 'booking-checkout-holds') {
          if (collection === 'bookings') {
            return Promise.resolve({ docs: [], totalDocs: confirmedCount })
          }
          return Promise.resolve({ docs: [], totalDocs: 0 })
        }

        let filtered = [...holds]
        const w = JSON.stringify(where ?? {})

        if (w.includes(String(TIMESLOT_ID))) {
          filtered = filtered.filter((h) => h.timeslot === TIMESLOT_ID)
        }
        if (w.includes(String(USER_ID)) && !w.includes(String(OTHER_USER_ID))) {
          filtered = filtered.filter((h) => h.user === USER_ID)
        }
        if (w.includes('"active"')) {
          filtered = filtered.filter((h) => h.status === 'active' && Date.parse(h.expiresAt) > now)
        }

        if (limit === 1) filtered = filtered.slice(0, 1)
        return Promise.resolve({ docs: filtered, totalDocs: filtered.length })
      }),
      findByID: vi.fn().mockImplementation(({ collection, id }: { collection: string; id: number }) => {
        if (collection === 'timeslots') {
          return Promise.resolve({
            id: TIMESLOT_ID,
            eventType: { places: PLACES },
          })
        }
        if (collection === 'booking-checkout-holds') {
          const h = holds.find((x) => x.id === id)
          return h ? Promise.resolve(h) : Promise.reject(new Error('Not found'))
        }
        return Promise.reject(new Error('Not found'))
      }),
      create: vi.fn().mockImplementation(({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        const doc = { id: nextId++, ...data } as HoldDoc
        if (collection === 'booking-checkout-holds') holds.push(doc)
        return Promise.resolve(doc)
      }),
      update: vi.fn().mockImplementation(({ id, data }: { collection: string; id: number; data: Record<string, unknown> }) => {
        const idx = holds.findIndex((h) => h.id === id)
        if (idx === -1) throw new Error('Not found')
        holds[idx] = { ...holds[idx]!, ...data } as HoldDoc
        return Promise.resolve(holds[idx])
      }),
      delete: vi.fn().mockImplementation(({ collection, id }: { collection: string; id: number }) => {
        if (collection === 'booking-checkout-holds') {
          holds = holds.filter((h) => h.id !== id)
        }
        return Promise.resolve({})
      }),
    }
  }

  describe('upsertCheckoutHold', () => {
    it('creates a new hold with 5-minute expiry when none exists', async () => {
      const payload = makePayload()

      const result = await upsertCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 1,
      })

      expect(result.quantity).toBe(1)
      expect(result.holdId).toBe(1)
      expect(Date.parse(result.expiresAt)).toBe(now + HOLD_TTL_MS)
      expect(payload.create).toHaveBeenCalledOnce()
      expect(payload.create.mock.calls[0][0].data).toMatchObject({
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        status: 'active',
      })
    })

    it('updates existing active hold instead of creating a duplicate', async () => {
      holds.push({
        id: 42,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now + 60_000),
        firstUpsertedAt: iso(now - 60_000),
        status: 'active',
      })
      const payload = makePayload()

      const result = await upsertCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 2,
      })

      expect(result.holdId).toBe(42)
      expect(result.quantity).toBe(2)
      expect(payload.create).not.toHaveBeenCalled()
      expect(payload.update).toHaveBeenCalled()
      expect(holds[0]!.quantity).toBe(2)
      expect(Date.parse(holds[0]!.expiresAt)).toBe(now + HOLD_TTL_MS)
    })

    it('rejects when capacity would be exceeded', async () => {
      confirmedCount = 9
      holds.push({
        id: 99,
        user: OTHER_USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now + HOLD_TTL_MS),
        status: 'active',
      })
      const payload = makePayload()

      await expect(
        upsertCheckoutHold(payload as never, {
          timeslotId: TIMESLOT_ID,
          userId: USER_ID,
          tenantId: TENANT_ID,
          quantity: 1,
        }),
      ).rejects.toThrow(/fully booked|Only 0 spot/i)
    })

    it('does not count expired holds toward capacity', async () => {
      confirmedCount = 9
      holds.push({
        id: 99,
        user: OTHER_USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now - 1000),
        status: 'active',
      })
      const payload = makePayload()

      const result = await upsertCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 1,
      })

      expect(result.quantity).toBe(1)
    })
  })

  describe('releaseCheckoutHold', () => {
    it('deletes the user active hold for the timeslot', async () => {
      holds.push({
        id: 7,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 2,
        expiresAt: iso(now + HOLD_TTL_MS),
        status: 'active',
      })
      const payload = makePayload()

      const result = await releaseCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
      })

      expect(result.released).toBe(1)
      expect(holds).toHaveLength(0)
    })

    it('returns released 0 when no hold exists', async () => {
      const payload = makePayload()
      const result = await releaseCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
      })
      expect(result.released).toBe(0)
    })
  })

  describe('adjustCheckoutHoldQuantity', () => {
    it('adjusts quantity on existing hold with capacity check', async () => {
      holds.push({
        id: 11,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now + HOLD_TTL_MS),
        firstUpsertedAt: iso(now),
        status: 'active',
      })
      const payload = makePayload()

      const result = await adjustCheckoutHoldQuantity(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 3,
      })

      expect(result.quantity).toBe(3)
      expect(holds[0]!.quantity).toBe(3)
    })
  })

  describe('extendCheckoutHold', () => {
    it('refreshes expiresAt to now + 5 minutes on pay start', async () => {
      holds.push({
        id: 20,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now + 30_000),
        firstUpsertedAt: iso(now - 4 * 60 * 1000),
        status: 'active',
      })
      const payload = makePayload()

      const result = await extendCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
      })

      expect(Date.parse(result.expiresAt)).toBe(now + HOLD_TTL_MS)
    })

    it('rejects extension past max lifetime from firstUpsertedAt', async () => {
      holds.push({
        id: 20,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now + 30_000),
        firstUpsertedAt: iso(now - HOLD_MAX_LIFETIME_MS),
        status: 'active',
      })
      const payload = makePayload()

      await expect(
        extendCheckoutHold(payload as never, {
          timeslotId: TIMESLOT_ID,
          userId: USER_ID,
        }),
      ).rejects.toThrow(/expired|maximum/i)
    })
  })

  describe('isHoldActive', () => {
    it('returns true when status active and expiresAt in future', () => {
      expect(
        isHoldActive({
          status: 'active',
          expiresAt: iso(now + 1000),
        }),
      ).toBe(true)
    })

    it('returns false when expired', () => {
      expect(
        isHoldActive({
          status: 'active',
          expiresAt: iso(now - 1000),
        }),
      ).toBe(false)
    })
  })

  describe('countActiveHoldQuantityForTimeslot', () => {
    it('sums quantities of non-expired active holds', async () => {
      holds.push(
        {
          id: 1,
          user: USER_ID,
          timeslot: TIMESLOT_ID,
          tenant: TENANT_ID,
          quantity: 2,
          expiresAt: iso(now + HOLD_TTL_MS),
          status: 'active',
        },
        {
          id: 2,
          user: OTHER_USER_ID,
          timeslot: TIMESLOT_ID,
          tenant: TENANT_ID,
          quantity: 1,
          expiresAt: iso(now - 1000),
          status: 'active',
        },
      )
      const payload = makePayload()

      const total = await countActiveHoldQuantityForTimeslot(payload as never, TIMESLOT_ID)
      expect(total).toBe(2)
    })
  })

  describe('computeRemainingCapacityWithHolds', () => {
    it('returns places minus confirmed bookings minus active hold quantities', async () => {
      confirmedCount = 3
      holds.push(
        {
          id: 1,
          user: USER_ID,
          timeslot: TIMESLOT_ID,
          tenant: TENANT_ID,
          quantity: 2,
          expiresAt: iso(now + HOLD_TTL_MS),
          status: 'active',
        },
        {
          id: 2,
          user: OTHER_USER_ID,
          timeslot: TIMESLOT_ID,
          tenant: TENANT_ID,
          quantity: 1,
          expiresAt: iso(now + HOLD_TTL_MS),
          status: 'active',
        },
      )
      const payload = makePayload()

      const remaining = await computeRemainingCapacityWithHolds(payload as never, TIMESLOT_ID)
      expect(remaining).toBe(PLACES - 3 - 3)
    })

    it('does not subtract expired holds', async () => {
      confirmedCount = 0
      holds.push({
        id: 1,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 4,
        expiresAt: iso(now - 1000),
        status: 'active',
      })
      const payload = makePayload()

      const remaining = await computeRemainingCapacityWithHolds(payload as never, TIMESLOT_ID)
      expect(remaining).toBe(PLACES)
    })
  })
})

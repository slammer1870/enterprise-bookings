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
  computeCapacityBreakdownWithHolds,
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
  tenant?: number
  quantity: number
  expiresAt: string
  firstUpsertedAt?: string
  status: string
  checkoutSessionId?: string
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
        const clauses = Array.isArray((where as { and?: unknown[] } | undefined)?.and)
          ? ((where as { and: Record<string, unknown>[] }).and)
          : []

        const timeslotEquals = clauses.find((c) => c.timeslot && typeof c.timeslot === 'object')
        if (timeslotEquals && (timeslotEquals.timeslot as { equals?: number }).equals === TIMESLOT_ID) {
          filtered = filtered.filter((h) => h.timeslot === TIMESLOT_ID)
        }

        const userEquals = clauses.find((c) => c.user && typeof c.user === 'object')
        if (userEquals && typeof (userEquals.user as { equals?: number }).equals === 'number') {
          const uid = (userEquals.user as { equals: number }).equals
          filtered = filtered.filter((h) => h.user === uid)
        }

        const statusEquals = clauses.find((c) => c.status && typeof c.status === 'object')
        const expiresGt = clauses.find((c) => c.expiresAt && typeof c.expiresAt === 'object' && 'greater_than' in (c.expiresAt as object))
        const expiresLte = clauses.find(
          (c) => c.expiresAt && typeof c.expiresAt === 'object' && 'less_than_equal' in (c.expiresAt as object),
        )

        if (statusEquals) {
          const status = (statusEquals.status as { equals?: string }).equals
          if (status === 'active') {
            if (expiresLte) {
              filtered = filtered.filter((h) => h.status === 'active' && Date.parse(h.expiresAt) <= now)
            } else if (expiresGt) {
              filtered = filtered.filter((h) => h.status === 'active' && Date.parse(h.expiresAt) > now)
            } else {
              filtered = filtered.filter((h) => h.status === 'active')
            }
          } else if (status) {
            filtered = filtered.filter((h) => h.status === status)
          }
        }

        const sessionEquals = clauses.find(
          (c) => c.checkoutSessionId && typeof c.checkoutSessionId === 'object',
        )
        if (sessionEquals) {
          const sid = (sessionEquals.checkoutSessionId as { equals?: string }).equals
          if (sid) filtered = filtered.filter((h) => h.checkoutSessionId === sid)
        }

        const idNotEquals = clauses.find(
          (c) => c.id && typeof c.id === 'object' && 'not_equals' in (c.id as object),
        )
        if (idNotEquals) {
          const skipId = (idNotEquals.id as { not_equals?: number }).not_equals
          if (typeof skipId === 'number') {
            filtered = filtered.filter((h) => h.id !== skipId)
          }
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

    it('releases duplicate active holds created by a concurrent race', async () => {
      // Simulate TOCTOU: another create landed while this upsert was in flight.
      holds.push({
        id: 77,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now + HOLD_TTL_MS),
        firstUpsertedAt: iso(now),
        status: 'active',
        checkoutSessionId: 'session-a',
      })
      const payload = makePayload()
      // First findUserActiveHold returns null (race window), then create, then collapse.
      let userActiveLookups = 0
      const originalFind = payload.find
      payload.find = vi.fn().mockImplementation(async (args: Parameters<typeof originalFind>[0]) => {
        const result = await originalFind(args)
        const clauses = Array.isArray((args.where as { and?: unknown[] } | undefined)?.and)
          ? ((args.where as { and: Record<string, unknown>[] }).and)
          : []
        const userEquals = clauses.find((c) => c.user && typeof c.user === 'object')
        const statusEquals = clauses.find((c) => c.status && typeof c.status === 'object')
        const idNotEquals = clauses.find(
          (c) => c.id && typeof c.id === 'object' && 'not_equals' in (c.id as object),
        )
        if (
          userEquals &&
          statusEquals &&
          (statusEquals.status as { equals?: string }).equals === 'active' &&
          !idNotEquals &&
          args.limit === 1
        ) {
          userActiveLookups += 1
          if (userActiveLookups === 1) {
            return { docs: [], totalDocs: 0 }
          }
        }
        return result
      })

      const result = await upsertCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 1,
        checkoutSessionId: 'session-b',
      })

      expect(result.holdId).toBe(1)
      expect(holds.filter((h) => h.status === 'active')).toHaveLength(1)
      expect(holds.find((h) => h.id === 77)?.status).toBe('expired')
      expect(holds.find((h) => h.id === 77)?.checkoutSessionId ?? null).toBeNull()
    })
  })

  describe('releaseCheckoutHold', () => {
    it('marks the user active hold as released for the timeslot', async () => {
      holds.push({
        id: 7,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 2,
        expiresAt: iso(now + HOLD_TTL_MS),
        status: 'active',
        checkoutSessionId: 'sess-7',
      })
      const payload = makePayload()

      const result = await releaseCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
      })

      expect(result.released).toBe(1)
      expect(holds).toHaveLength(1)
      expect(holds[0]!.status).toBe('released')
    })

    it('returns released 0 when no hold exists', async () => {
      const payload = makePayload()
      const result = await releaseCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
      })
      expect(result.released).toBe(0)
    })

    it('plants a released tombstone when releasing a session before upsert completes', async () => {
      const payload = makePayload()
      const result = await releaseCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        checkoutSessionId: 'sess-early',
      })
      expect(result.released).toBe(1)
      expect(holds).toHaveLength(1)
      expect(holds[0]).toMatchObject({
        status: 'released',
        checkoutSessionId: 'sess-early',
      })
    })
  })

  describe('upsertCheckoutHold abandoned session', () => {
    it('does not recreate an active hold after the same session was released', async () => {
      holds.push({
        id: 9,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now + HOLD_TTL_MS),
        status: 'released',
        checkoutSessionId: 'sess-abandon',
      })
      const payload = makePayload()

      const result = await upsertCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 1,
        checkoutSessionId: 'sess-abandon',
      })

      expect(result.abandoned).toBe(true)
      expect(result.quantity).toBe(0)
      expect(holds.filter((h) => h.status === 'active')).toHaveLength(0)
      expect(payload.create).not.toHaveBeenCalled()
    })

    it('clears leftover active holds when the session tombstone already exists', async () => {
      holds.push(
        {
          id: 9,
          user: USER_ID,
          timeslot: TIMESLOT_ID,
          tenant: TENANT_ID,
          quantity: 1,
          expiresAt: iso(now + HOLD_TTL_MS),
          status: 'released',
          checkoutSessionId: 'sess-abandon',
        },
        {
          id: 10,
          user: USER_ID,
          timeslot: TIMESLOT_ID,
          tenant: TENANT_ID,
          quantity: 1,
          expiresAt: iso(now + HOLD_TTL_MS),
          status: 'active',
          checkoutSessionId: 'sess-other',
        },
      )
      const payload = makePayload()

      const result = await upsertCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 1,
        checkoutSessionId: 'sess-abandon',
      })

      expect(result.abandoned).toBe(true)
      expect(holds.find((h) => h.id === 10)?.status).toBe('released')
      expect(holds.filter((h) => h.status === 'active')).toHaveLength(0)
    })

    it('does not recreate capacity when release wins after the initial abandoned check (TOCTOU)', async () => {
      holds.push({
        id: 42,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 1,
        expiresAt: iso(now),
        status: 'released',
        checkoutSessionId: 'sess-race',
      })
      const payload = makePayload()
      let releasedSessionLookups = 0
      const innerFind = payload.find
      payload.find = vi.fn().mockImplementation(async (args: {
        collection: string
        where?: Record<string, unknown>
        limit?: number
      }) => {
        const clauses = Array.isArray((args.where as { and?: unknown[] } | undefined)?.and)
          ? ((args.where as { and: Record<string, unknown>[] }).and)
          : []
        const statusEquals = clauses.find((c) => c.status && typeof c.status === 'object')
        const sessionEquals = clauses.find(
          (c) => c.checkoutSessionId && typeof c.checkoutSessionId === 'object',
        )
        const lookingForReleasedSession =
          args.collection === 'booking-checkout-holds' &&
          (statusEquals?.status as { equals?: string } | undefined)?.equals === 'released' &&
          Boolean((sessionEquals?.checkoutSessionId as { equals?: string } | undefined)?.equals)

        if (lookingForReleasedSession) {
          releasedSessionLookups += 1
          // First check: pretend the session is still live (release hasn't landed yet).
          if (releasedSessionLookups === 1) {
            return { docs: [], totalDocs: 0 }
          }
        }
        return innerFind(args)
      })

      const result = await upsertCheckoutHold(payload as never, {
        timeslotId: TIMESLOT_ID,
        userId: USER_ID,
        tenantId: TENANT_ID,
        quantity: 1,
        checkoutSessionId: 'sess-race',
      })

      expect(result.abandoned).toBe(true)
      expect(result.quantity).toBe(0)
      expect(holds.filter((h) => h.status === 'active')).toHaveLength(0)
      expect(payload.create).not.toHaveBeenCalled()
      expect(releasedSessionLookups).toBeGreaterThanOrEqual(2)
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

    it('coerces Postgres numeric quantity strings when summing holds', async () => {
      holds.push({
        id: 1,
        user: USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        // Neon/drizzle often returns numeric columns as strings
        quantity: '3' as unknown as number,
        expiresAt: iso(now + HOLD_TTL_MS),
        status: 'active',
      })
      const payload = makePayload()

      const total = await countActiveHoldQuantityForTimeslot(payload as never, TIMESLOT_ID)
      expect(total).toBe(3)
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

    it('coerces Postgres numeric places strings so capacity is not treated as zero', async () => {
      confirmedCount = 1
      const payload = makePayload()
      payload.findByID.mockImplementation(({ collection }: { collection: string; id: number }) => {
        if (collection === 'timeslots') {
          return Promise.resolve({
            id: TIMESLOT_ID,
            eventType: { places: '12' },
          })
        }
        return Promise.reject(new Error('Not found'))
      })

      const remaining = await computeRemainingCapacityWithHolds(payload as never, TIMESLOT_ID)
      expect(remaining).toBe(11)
    })

    it('shows sold out when active hold quantities fill remaining places', async () => {
      confirmedCount = 1
      holds.push({
        id: 1,
        user: OTHER_USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: '11' as unknown as number,
        expiresAt: iso(now + HOLD_TTL_MS),
        status: 'active',
      })
      const payload = makePayload()
      payload.findByID.mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'timeslots') {
          return Promise.resolve({
            id: TIMESLOT_ID,
            eventType: { places: '12' },
          })
        }
        return Promise.reject(new Error('Not found'))
      })

      const remaining = await computeRemainingCapacityWithHolds(payload as never, TIMESLOT_ID)
      expect(remaining).toBe(0)
    })

    it('exposes confirmed-only remaining separately from hold-adjusted remaining', async () => {
      confirmedCount = 1
      holds.push({
        id: 1,
        user: OTHER_USER_ID,
        timeslot: TIMESLOT_ID,
        tenant: TENANT_ID,
        quantity: 2,
        expiresAt: iso(now + HOLD_TTL_MS),
        status: 'active',
      })
      const payload = makePayload()

      const breakdown = await computeCapacityBreakdownWithHolds(payload as never, TIMESLOT_ID)
      expect(breakdown).toEqual({
        places: PLACES,
        confirmed: 1,
        held: 2,
        remaining: PLACES - 1 - 2,
        remainingConfirmedOnly: PLACES - 1,
      })
    })
  })
})

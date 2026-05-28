/**
 * Regression tests: clearExisting must not delete timeslots that belong to a
 * different branch (location) within the same tenant.
 *
 * Bug: the clearExisting delete query filtered by tenant + date range only,
 * ignoring branch, so saving Location A's scheduler wiped Location B's slots.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { EventType } from '@repo/shared-types'

import { generateTimeslotsFromScheduleWithTenant } from '@/tasks/generate-timeslots-with-tenant'

const HOOK_TIMEOUT = 300_000
const TEST_TIMEOUT = 60_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a week where every day has one slot at 10–11 AM on the supplied day. */
function weekWithDailySlot(day: Date, eventTypeId: number, location: string) {
  const slotStart = new Date(day)
  slotStart.setHours(10, 0, 0, 0)
  const slotEnd = new Date(day)
  slotEnd.setHours(11, 0, 0, 0)
  const slot = {
    startTime: slotStart.toISOString(),
    endTime: slotEnd.toISOString(),
    eventType: eventTypeId,
    location,
    active: true,
  }
  const empty = { timeSlot: [] as typeof slot[] }
  const jsDay = day.getDay()
  // JS day 0 (Sun) → schedule index 6; Mon–Sat → index 0–5
  const scheduleIndex = jsDay === 0 ? 6 : jsDay - 1
  const days = Array.from({ length: 7 }, (_, i) =>
    i === scheduleIndex ? { timeSlot: [slot] } : { ...empty },
  )
  return { days }
}

async function runTask(
  payload: Payload,
  tenantId: number,
  input: Record<string, unknown>,
): Promise<{ success?: boolean; message?: string }> {
  const raw = (await generateTimeslotsFromScheduleWithTenant({
    input: { ...input, tenant: tenantId },
    req: { payload, context: { tenant: tenantId } } as any,
    job: {} as any,
  } as any)) as { output?: { success?: boolean; message?: string } }
  return { success: raw?.output?.success, message: raw?.output?.message }
}

async function countTimeslots(
  payload: Payload,
  tenantId: number,
  branchId: number,
  start: Date,
  end: Date,
): Promise<number> {
  const result = await payload.find({
    collection: 'timeslots',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { branch: { equals: branchId } },
        { startTime: { greater_than_equal: start.toISOString() } },
        { endTime: { less_than_equal: end.toISOString() } },
      ],
    },
    limit: 200,
    overrideAccess: true,
  })
  return result.docs.length
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('scheduler clearExisting — branch isolation', () => {
  let payload: Payload
  let tenantId: number
  let branchAId: number
  let branchBId: number
  let eventType: EventType

  /** A week-long window starting 60 days out — far enough to avoid collisions. */
  let startDate: Date
  let endDate: Date
  /** A representative day within the window used to build week templates. */
  let planDay: Date

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Branch Isolation Tenant',
        slug: `branch-isolation-${Date.now()}`,
      },
      overrideAccess: true,
    })
    tenantId = Number((tenant as { id: number }).id)

    const locA = await payload.create({
      collection: 'locations',
      data: { name: 'Location A', slug: `loc-a-${Date.now()}`, tenant: tenantId, active: true },
      overrideAccess: true,
    })
    branchAId = Number((locA as { id: number }).id)

    const locB = await payload.create({
      collection: 'locations',
      data: { name: 'Location B', slug: `loc-b-${Date.now()}`, tenant: tenantId, active: true },
      overrideAccess: true,
    })
    branchBId = Number((locB as { id: number }).id)

    eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Isolation ET ${Date.now()}`,
        places: 8,
        description: 'Branch isolation regression',
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as EventType

    const base = new Date()
    base.setDate(base.getDate() + 60)
    base.setHours(0, 0, 0, 0)

    startDate = new Date(base)
    endDate = new Date(base)
    endDate.setDate(endDate.getDate() + 6)
    endDate.setHours(23, 59, 59, 999)

    planDay = new Date(base)
    planDay.setHours(10, 0, 0, 0)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy?.()
    }
  })

  // -------------------------------------------------------------------------
  // Test 1 — the regression
  // -------------------------------------------------------------------------
  it(
    'preserves Location B timeslots when Location A scheduler runs with clearExisting: true',
    async () => {
      // ── Pre-seed: one timeslot for each branch ──────────────────────────
      const slotTime = new Date(planDay)
      slotTime.setHours(14, 0, 0, 0)

      const slotA = await payload.create({
        collection: 'timeslots',
        data: {
          date: slotTime.toISOString(),
          startTime: slotTime.toISOString(),
          endTime: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString(),
          eventType: eventType.id,
          tenant: tenantId,
          branch: branchAId,
          active: true,
        },
        overrideAccess: true,
      })

      const slotB = await payload.create({
        collection: 'timeslots',
        data: {
          date: slotTime.toISOString(),
          startTime: slotTime.toISOString(),
          endTime: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString(),
          eventType: eventType.id,
          tenant: tenantId,
          branch: branchBId,
          active: true,
        },
        overrideAccess: true,
      })

      // Both should exist before the task runs
      await expect(
        payload.findByID({ collection: 'timeslots', id: slotA.id, overrideAccess: true }),
      ).resolves.toBeDefined()
      await expect(
        payload.findByID({ collection: 'timeslots', id: slotB.id, overrideAccess: true }),
      ).resolves.toBeDefined()

      // ── Run Location A's scheduler with clearExisting: true ─────────────
      const out = await runTask(payload, tenantId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        week: weekWithDailySlot(planDay, Number(eventType.id), 'Room A'),
        clearExisting: true,
        defaultEventType: eventType.id,
        lockOutTime: 0,
        branch: branchAId,
      })

      expect(out.success).toBe(true)

      // ── Location A's pre-seeded slot should be gone (cleared) ───────────
      const slotAAfter = await payload
        .findByID({ collection: 'timeslots', id: slotA.id, overrideAccess: true })
        .catch(() => null)
      expect(slotAAfter).toBeNull()

      // ── Location B's slot must still exist ──────────────────────────────
      const slotBAfter = await payload.findByID({
        collection: 'timeslots',
        id: slotB.id,
        overrideAccess: true,
      })
      expect(slotBAfter).toBeDefined()
      expect(slotBAfter.id).toBe(slotB.id)
    },
    TEST_TIMEOUT,
  )

  // -------------------------------------------------------------------------
  // Test 2 — new timeslots for A don't bleed into B's count
  // -------------------------------------------------------------------------
  it(
    'newly generated timeslots for Location A are scoped to Location A only',
    async () => {
      const bCountBefore = await countTimeslots(payload, tenantId, branchBId, startDate, endDate)

      const out = await runTask(payload, tenantId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        week: weekWithDailySlot(planDay, Number(eventType.id), 'Room A'),
        clearExisting: false,
        defaultEventType: eventType.id,
        lockOutTime: 0,
        branch: branchAId,
      })

      expect(out.success).toBe(true)

      // Location A should have at least one generated slot in the window
      const aCount = await countTimeslots(payload, tenantId, branchAId, startDate, endDate)
      expect(aCount).toBeGreaterThan(0)

      // Location B's count must not have grown
      const bCountAfter = await countTimeslots(payload, tenantId, branchBId, startDate, endDate)
      expect(bCountAfter).toBe(bCountBefore)
    },
    TEST_TIMEOUT,
  )

  // -------------------------------------------------------------------------
  // Test 3 — both locations can clear independently
  // -------------------------------------------------------------------------
  it(
    'Location B scheduler with clearExisting: true does not affect Location A timeslots',
    async () => {
      // Ensure Location A has at least one slot in the window
      await runTask(payload, tenantId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        week: weekWithDailySlot(planDay, Number(eventType.id), 'Room A'),
        clearExisting: false,
        defaultEventType: eventType.id,
        lockOutTime: 0,
        branch: branchAId,
      })

      const aCountBefore = await countTimeslots(payload, tenantId, branchAId, startDate, endDate)
      expect(aCountBefore).toBeGreaterThan(0)

      // Now run Location B with clearExisting: true
      const out = await runTask(payload, tenantId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        week: weekWithDailySlot(planDay, Number(eventType.id), 'Room B'),
        clearExisting: true,
        defaultEventType: eventType.id,
        lockOutTime: 0,
        branch: branchBId,
      })

      expect(out.success).toBe(true)

      // Location A's count must be unchanged
      const aCountAfter = await countTimeslots(payload, tenantId, branchAId, startDate, endDate)
      expect(aCountAfter).toBe(aCountBefore)
    },
    TEST_TIMEOUT,
  )
})

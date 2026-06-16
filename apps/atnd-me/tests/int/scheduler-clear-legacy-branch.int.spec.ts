/**
 * Regression: clearExisting must remove legacy timeslots that have no `branch`
 * when the tenant has a single active location.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { EventType } from '@repo/shared-types'

import { generateTimeslotsFromScheduleWithTenant } from '@/tasks/generate-timeslots-with-tenant'

const HOOK_TIMEOUT = 300_000
const TEST_TIMEOUT = 60_000

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

describe('scheduler clearExisting — legacy null branch timeslots', () => {
  let payload: Payload
  let tenantId: number
  let branchId: number
  let eventType: EventType
  let startDate: Date
  let endDate: Date
  let planDay: Date

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Legacy Branch Clear Tenant',
        slug: `legacy-branch-clear-${Date.now()}`,
      },
      overrideAccess: true,
    })
    tenantId = Number((tenant as { id: number }).id)

    const location = await payload.create({
      collection: 'locations',
      data: {
        name: 'Main Studio',
        slug: `main-studio-${Date.now()}`,
        tenant: tenantId,
        active: true,
      },
      overrideAccess: true,
    })
    branchId = Number((location as { id: number }).id)

    eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Legacy Clear ET ${Date.now()}`,
        places: 8,
        description: 'Legacy branch clear regression',
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as EventType

    const base = new Date()
    base.setDate(base.getDate() + 70)
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

  it(
    'clears legacy timeslots without branch when tenant has one active location',
    async () => {
      const slotTime = new Date(planDay)
      slotTime.setHours(14, 0, 0, 0)

      const legacySlot = await payload.create({
        collection: 'timeslots',
        data: {
          date: slotTime.toISOString(),
          startTime: slotTime.toISOString(),
          endTime: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString(),
          eventType: eventType.id,
          tenant: tenantId,
          active: true,
        },
        overrideAccess: true,
      })

      const out = await runTask(payload, tenantId, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        week: weekWithDailySlot(planDay, Number(eventType.id), 'Studio'),
        clearExisting: true,
        defaultEventType: eventType.id,
        lockOutTime: 0,
        branch: branchId,
      })

      expect(out.success).toBe(true)

      const legacyAfter = await payload
        .findByID({ collection: 'timeslots', id: legacySlot.id, overrideAccess: true })
        .catch(() => null)
      expect(legacyAfter).toBeNull()
    },
    TEST_TIMEOUT,
  )
})

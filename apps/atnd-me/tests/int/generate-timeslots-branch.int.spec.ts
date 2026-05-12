/**
 * Phase 7 Chunk 11 — `generateTimeslotsFromSchedule`: branch default / error when tenant has `locations`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { EventType } from '@repo/shared-types'

import { generateTimeslotsFromScheduleWithTenant } from '@/tasks/generate-timeslots-with-tenant'

const HOOK_TIMEOUT = 300000

function weekForSingleCalendarDay(day: Date, eventTypeId: number) {
  const slotStart = new Date(day)
  slotStart.setHours(10, 0, 0, 0)
  const slotEnd = new Date(day)
  slotEnd.setHours(11, 0, 0, 0)
  const slot = {
    startTime: slotStart.toISOString(),
    endTime: slotEnd.toISOString(),
    eventType: eventTypeId,
    location: 'Room',
    active: true,
  }
  const empty = { timeSlot: [] as typeof slot[] }
  const jsDay = day.getDay()
  const scheduleIndex = jsDay === 0 ? 6 : jsDay - 1
  const days = Array.from({ length: 7 }, (_, i) => (i === scheduleIndex ? { timeSlot: [slot] } : { ...empty }))
  return { days }
}

async function runGenerateTask(
  payload: Payload,
  tenantId: number,
  input: Record<string, unknown>,
): Promise<{ success?: boolean; message?: string }> {
  const raw = (await generateTimeslotsFromScheduleWithTenant({
    input: { ...input, tenant: tenantId },
    req: { payload, context: { tenant: tenantId } } as any,
    job: {} as any,
  } as any)) as { output?: { success?: boolean; message?: string } }
  const out = raw?.output
  return { success: out?.success, message: out?.message }
}

describe('generateTimeslotsFromSchedule — branch (locations)', () => {
  let payload: Payload
  let tenantId: number
  let eventType: EventType
  let planDay: Date

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Branch Task Tenant',
        slug: `branch-task-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    tenantId = Number((tenant as { id: number }).id)

    eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Branch Task ET ${Date.now()}`,
        places: 8,
        description: 'Chunk 11',
        tenant: tenantId,
      },
      overrideAccess: true,
    })) as EventType

    planDay = new Date()
    planDay.setDate(planDay.getDate() + 28)
    planDay.setHours(12, 0, 0, 0)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy?.()
    }
  })

  it('returns an error when the tenant has multiple active locations and branch is omitted', async () => {
    await payload.create({
      collection: 'locations',
      data: { name: 'Site A', slug: `site-a-${Date.now()}`, tenant: tenantId, active: true },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'locations',
      data: { name: 'Site B', slug: `site-b-${Date.now()}`, tenant: tenantId, active: true },
      overrideAccess: true,
    })

    const startDate = new Date(planDay)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 2)

    const out = await runGenerateTask(payload, tenantId, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      week: weekForSingleCalendarDay(planDay, Number(eventType.id)),
      clearExisting: false,
      defaultEventType: eventType.id,
      lockOutTime: 60,
    })

    expect(out.success).toBe(false)
    expect(out.message ?? '').toMatch(/more than one active site/i)
  })

  it('succeeds with explicit branch when multiple active locations exist', async () => {
    const loc = await payload.create({
      collection: 'locations',
      data: { name: 'Site Pick', slug: `site-pick-${Date.now()}`, tenant: tenantId, active: true },
      overrideAccess: true,
    })
    const branchId = Number((loc as { id: number }).id)

    const startDate = new Date(planDay)
    startDate.setDate(startDate.getDate() + 7)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 2)
    const day = new Date(startDate)
    day.setHours(12, 0, 0, 0)

    const out = await runGenerateTask(payload, tenantId, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      week: weekForSingleCalendarDay(day, Number(eventType.id)),
      clearExisting: false,
      defaultEventType: eventType.id,
      lockOutTime: 60,
      branch: branchId,
    })

    expect(out.success).toBe(true)

    const found = await payload.find({
      collection: 'timeslots',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { branch: { equals: branchId } },
          { startTime: { greater_than_equal: startDate.toISOString() } },
        ],
      },
      limit: 20,
      overrideAccess: true,
    })
    expect(found.docs.length).toBeGreaterThan(0)
  })

  it('defaults branch to the only active location when branch is omitted', async () => {
    const soloTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Solo Branch Tenant',
        slug: `solo-branch-${Date.now()}`,
      },
      overrideAccess: true,
    })
    const soloTid = Number((soloTenant as { id: number }).id)

    const soloLoc = await payload.create({
      collection: 'locations',
      data: { name: 'Only Site', slug: `only-site-${Date.now()}`, tenant: soloTid, active: true },
      overrideAccess: true,
    })
    const soloBranchId = Number((soloLoc as { id: number }).id)

    const soloEt = (await payload.create({
      collection: 'event-types',
      data: {
        name: `Solo ET ${Date.now()}`,
        places: 5,
        description: 'solo',
        tenant: soloTid,
      },
      overrideAccess: true,
    })) as EventType

    const d = new Date()
    d.setDate(d.getDate() + 35)
    d.setHours(15, 0, 0, 0)
    const startDate = new Date(d)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 2)

    const out = await runGenerateTask(payload, soloTid, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      week: weekForSingleCalendarDay(d, Number(soloEt.id)),
      clearExisting: false,
      defaultEventType: soloEt.id,
      lockOutTime: 30,
    })

    expect(out.success).toBe(true)

    const found = await payload.find({
      collection: 'timeslots',
      where: {
        and: [
          { tenant: { equals: soloTid } },
          { branch: { equals: soloBranchId } },
        ],
      },
      limit: 10,
      overrideAccess: true,
    })
    expect(found.docs.length).toBeGreaterThan(0)
  })
})

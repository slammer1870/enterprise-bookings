import type { Page } from '@playwright/test'
import { TZDate } from '@date-fns/tz'
import { formatInTimeZone } from '@repo/shared-utils'
import type { Payload } from 'payload'
import {
  createTestBooking,
  createTestEventType,
  createTestTimeslot,
  getPayloadInstance,
} from './data-helpers'

const DEFAULT_TIME_ZONE = 'Europe/Dublin'

export type SchedulerDedupeSeed = {
  tenantId: number
  branchId: number
  eventTypeId: number
  eventTypeName: string
  startDate: Date
  endDate: Date
  bookedTimeslotIds: number[]
  clearedTimeslotIds: number[]
  protectedKeys: string[]
  mondayTemplateStart: string
  mondayTemplateEnd: string
  wednesdayTemplateStart: string
  wednesdayTemplateEnd: string
}

export function timeslotDedupeKey(args: {
  startTime: string
  endTime: string
  location?: unknown
}): string {
  const locationKey =
    args.location == null || args.location === '' ? '' : String(args.location)
  return `${args.startTime}|${args.endTime}|${locationKey}`
}

export function emptySchedulerWeekDays() {
  return Array.from({ length: 7 }, () => ({ timeSlot: [] as Record<string, unknown>[] }))
}

export function buildSchedulerWeekDays(args: {
  eventTypeId: number
  mondayStartIso: string
  mondayEndIso: string
  wednesdayStartIso: string
  wednesdayEndIso: string
  location?: string | null
}) {
  const days = emptySchedulerWeekDays()
  const slotBase = {
    eventType: args.eventTypeId,
    location: args.location ?? null,
    active: true,
  }
  days[0] = {
    timeSlot: [
      {
        ...slotBase,
        startTime: args.mondayStartIso,
        endTime: args.mondayEndIso,
      },
    ],
  }
  days[2] = {
    timeSlot: [
      {
        ...slotBase,
        startTime: args.wednesdayStartIso,
        endTime: args.wednesdayEndIso,
      },
    ],
  }
  return days
}

function calendarDayAtWallClock(
  day: Date,
  hour: number,
  minute: number,
  timeZone: string,
): { start: Date; end: Date } {
  const ymd = formatInTimeZone(day, 'yyyy-MM-dd', timeZone)
  const [year, month, date] = ymd.split('-').map(Number)
  const start = new TZDate(year, month - 1, date, hour, minute, 0, 0, timeZone)
  const end = new TZDate(year, month - 1, date, hour + 1, minute, 0, 0, timeZone)
  return { start, end }
}

function eachCalendarDay(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cursor <= endDay) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function scheduleTemplateIso(referenceDay: Date, hour: number, minute: number): string {
  const base = new Date(referenceDay)
  base.setHours(0, 0, 0, 0)
  return new Date(base.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000).toISOString()
}

export async function deleteSchedulersForTenant(tenantId: number): Promise<void> {
  const payload = await getPayloadInstance()
  const existing = await payload.find({
    collection: 'scheduler',
    where: { tenant: { equals: tenantId } },
    limit: 50,
    overrideAccess: true,
  })
  for (const doc of existing.docs) {
    await payload.delete({
      collection: 'scheduler',
      id: doc.id,
      overrideAccess: true,
    })
  }
}

export async function seedSchedulerClearExistingDedupeScenario(args: {
  tenantId: number
  branchId: number
  bookingUserId: number
  workerIndex: number
  timeZone?: string
}): Promise<SchedulerDedupeSeed> {
  const timeZone = args.timeZone ?? DEFAULT_TIME_ZONE

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 21)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date()
  endDate.setDate(endDate.getDate() + 21)
  endDate.setHours(23, 59, 59, 999)

  const eventTypeName = `E2E Scheduler Dedupe ${Date.now()}-w${args.workerIndex}`
  const eventType = await createTestEventType(
    args.tenantId,
    eventTypeName,
    10,
    'Scheduler clearExisting dedupe regression',
    args.workerIndex,
  )

  const mondayTemplateStart = scheduleTemplateIso(startDate, 10, 0)
  const mondayTemplateEnd = scheduleTemplateIso(startDate, 11, 0)
  const wednesdayTemplateStart = scheduleTemplateIso(startDate, 14, 0)
  const wednesdayTemplateEnd = scheduleTemplateIso(startDate, 15, 0)

  const bookedTimeslotIds: number[] = []
  const clearedTimeslotIds: number[] = []
  const protectedKeys: string[] = []

  let mondayCount = 0
  let wednesdayCount = 0

  for (const day of eachCalendarDay(startDate, endDate)) {
    const dayOfWeek = day.getDay()

    if (dayOfWeek === 1 && mondayCount < 4) {
      const bookedWindow = calendarDayAtWallClock(day, 10, 0, timeZone)
      const bookedTimeslot = await createTestTimeslot(
        args.tenantId,
        eventType.id,
        bookedWindow.start,
        bookedWindow.end,
        undefined,
        true,
        args.branchId,
      )
      await createTestBooking(args.bookingUserId, bookedTimeslot.id, 'confirmed')
      bookedTimeslotIds.push(Number(bookedTimeslot.id))
      protectedKeys.push(
        timeslotDedupeKey({
          startTime: bookedTimeslot.startTime as string,
          endTime: bookedTimeslot.endTime as string,
          location: bookedTimeslot.location,
        }),
      )

      const extraWindow = calendarDayAtWallClock(day, 9, 0, timeZone)
      const extraTimeslot = await createTestTimeslot(
        args.tenantId,
        eventType.id,
        extraWindow.start,
        extraWindow.end,
        undefined,
        true,
        args.branchId,
      )
      clearedTimeslotIds.push(Number(extraTimeslot.id))
      mondayCount += 1
    }

    if (dayOfWeek === 3 && wednesdayCount < 3) {
      const bookedWindow = calendarDayAtWallClock(day, 14, 0, timeZone)
      const bookedTimeslot = await createTestTimeslot(
        args.tenantId,
        eventType.id,
        bookedWindow.start,
        bookedWindow.end,
        undefined,
        true,
        args.branchId,
      )
      await createTestBooking(args.bookingUserId, bookedTimeslot.id, 'confirmed')
      bookedTimeslotIds.push(Number(bookedTimeslot.id))
      protectedKeys.push(
        timeslotDedupeKey({
          startTime: bookedTimeslot.startTime as string,
          endTime: bookedTimeslot.endTime as string,
          location: bookedTimeslot.location,
        }),
      )
      wednesdayCount += 1
    }

    if (dayOfWeek === 5 && clearedTimeslotIds.length < 12) {
      const fridayWindow = calendarDayAtWallClock(day, 16, 0, timeZone)
      const fridayTimeslot = await createTestTimeslot(
        args.tenantId,
        eventType.id,
        fridayWindow.start,
        fridayWindow.end,
        undefined,
        true,
        args.branchId,
      )
      clearedTimeslotIds.push(Number(fridayTimeslot.id))
    }
  }

  return {
    tenantId: args.tenantId,
    branchId: args.branchId,
    eventTypeId: Number(eventType.id),
    eventTypeName: String(eventType.name),
    startDate,
    endDate,
    bookedTimeslotIds,
    clearedTimeslotIds,
    protectedKeys,
    mondayTemplateStart,
    mondayTemplateEnd,
    wednesdayTemplateStart,
    wednesdayTemplateEnd,
  }
}

async function adminAuthHeader(
  page: Page,
  email: string,
  password: string,
): Promise<Record<string, string>> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request: any = page.context().request
  const cookies: Array<{ name: string; value: string }> = await page.context().cookies()
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

  const res = await request.post(`${baseUrl}/api/users/login`, {
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    data: { email, password },
    timeout: 30000,
  })
  if (!res.ok()) return {}
  const json: any = await res.json().catch(() => null)
  const token = json?.token ?? json?.doc?.token ?? json?.user?.token
  if (!token || typeof token !== 'string') return {}
  return { Authorization: `JWT ${token}` }
}

export async function createSchedulerViaAdminRequest(
  page: Page,
  args: {
    email: string
    password: string
    tenantId: number
    branchId: number
    startDate: Date
    endDate: Date
    eventTypeId: number
    clearExisting: boolean
    weekDays: ReturnType<typeof buildSchedulerWeekDays>
    lockOutTime?: number
  },
): Promise<number> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const request: any = page.context().request
  const cookies: Array<{ name: string; value: string }> = await page.context().cookies()
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ')

  const res = await request.post(`${baseUrl}/api/scheduler`, {
    headers: {
      ...(await adminAuthHeader(page, args.email, args.password)),
      Cookie: cookieHeader,
      'Content-Type': 'application/json',
    },
    data: {
      tenant: args.tenantId,
      branch: args.branchId,
      startDate: args.startDate.toISOString(),
      endDate: args.endDate.toISOString(),
      defaultEventType: args.eventTypeId,
      lockOutTime: args.lockOutTime ?? 0,
      clearExisting: args.clearExisting,
      week: { days: args.weekDays },
    },
  })

  if (!res.ok()) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Failed to create scheduler via admin API: ${res.status()} ${txt}`)
  }

  const json: any = await res.json().catch(() => null)
  const id = json?.doc?.id ?? json?.id
  if (id == null) throw new Error(`Unexpected create scheduler response: ${JSON.stringify(json)}`)
  return Number(id)
}

export async function waitForSchedulerGenerationSettled(args: {
  payload?: Payload
  timeoutMs?: number
} = {}): Promise<void> {
  const payload = args.payload ?? (await getPayloadInstance())
  const timeoutMs = args.timeoutMs ?? (process.env.CI ? 180_000 : 120_000)
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const processing = await payload.find({
      collection: 'payload-jobs',
      where: {
        and: [
          { taskSlug: { equals: 'generateTimeslotsFromSchedule' } },
          { processing: { equals: true } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (processing.docs.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const stillProcessing = await payload.find({
        collection: 'payload-jobs',
        where: {
          and: [
            { taskSlug: { equals: 'generateTimeslotsFromSchedule' } },
            { processing: { equals: true } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })
      if (stillProcessing.docs.length === 0) return
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`Scheduler generation did not settle within ${timeoutMs}ms`)
}

export async function findTenantTimeslotsInRange(args: {
  tenantId: number
  branchId?: number
  startDate: Date
  endDate: Date
}): Promise<
  Array<{
    id: number
    startTime: string
    endTime: string
    location?: unknown
  }>
> {
  const payload = await getPayloadInstance()
  const where: Record<string, unknown> = {
    and: [
      { tenant: { equals: args.tenantId } },
      { startTime: { greater_than_equal: args.startDate.toISOString() } },
      { endTime: { less_than_equal: args.endDate.toISOString() } },
    ],
  }
  if (args.branchId != null) {
    ;(where.and as unknown[]).push({ branch: { equals: args.branchId } })
  }

  const result = await payload.find({
    collection: 'timeslots',
    where: where as any,
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs.map((doc) => ({
    id: Number(doc.id),
    startTime: String((doc as { startTime?: string }).startTime),
    endTime: String((doc as { endTime?: string }).endTime),
    location: (doc as { location?: unknown }).location,
  }))
}

export async function assertSchedulerDedupeExpectations(args: {
  seed: SchedulerDedupeSeed
}): Promise<void> {
  const payload = await getPayloadInstance()
  const { seed } = args

  for (const id of seed.bookedTimeslotIds) {
    const timeslot = await payload.findByID({
      collection: 'timeslots',
      id,
      depth: 0,
      overrideAccess: true,
    })
    if (!timeslot) {
      throw new Error(`Expected booked timeslot ${id} to still exist after generation`)
    }
  }

  for (const id of seed.clearedTimeslotIds) {
    const timeslot = await payload
      .findByID({
        collection: 'timeslots',
        id,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)
    if (timeslot) {
      throw new Error(`Expected unbooked timeslot ${id} to be cleared before regeneration`)
    }
  }

  const timeslots = await findTenantTimeslotsInRange({
    tenantId: seed.tenantId,
    branchId: seed.branchId,
    startDate: seed.startDate,
    endDate: seed.endDate,
  })

  const keyCounts = new Map<string, number>()
  const idsByKey = new Map<string, number[]>()
  for (const timeslot of timeslots) {
    const key = timeslotDedupeKey(timeslot)
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1)
    const ids = idsByKey.get(key) ?? []
    ids.push(timeslot.id)
    idsByKey.set(key, ids)
  }

  for (const [key, count] of keyCounts.entries()) {
    if (count > 1) {
      throw new Error(
        `Duplicate timeslot key "${key}" appears ${count} times (ids: ${idsByKey.get(key)?.join(', ')})`,
      )
    }
  }

  for (const key of seed.protectedKeys) {
    if ((keyCounts.get(key) ?? 0) !== 1) {
      throw new Error(`Expected protected booked slot key "${key}" to exist exactly once after generation`)
    }
  }

  if (timeslots.length < seed.bookedTimeslotIds.length + 2) {
    throw new Error(
      `Expected regenerated schedule to create additional timeslots beyond preserved bookings (found ${timeslots.length})`,
    )
  }
}

export async function setPayloadTenantCookies(page: Page, tenantId: number): Promise<void> {
  const origin = new URL(page.url()).origin
  await page.context().addCookies([
    { name: 'payload-tenant', value: String(tenantId), url: `${origin}/` },
    { name: 'payload-tenant', value: String(tenantId), url: `${origin}/admin/` },
    { name: 'payload-tenant', value: String(tenantId), url: `${origin}/admin/collections/` },
  ])
}
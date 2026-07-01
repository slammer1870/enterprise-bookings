import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { EventType, Timeslot, User } from '@repo/shared-types'
import { createTRPCContext, appRouter } from '@repo/trpc'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { generateTimeslotsFromScheduleWithTenant } from '@/tasks/generate-timeslots-with-tenant'
import { TZDate } from '@date-fns/tz'

const TEST_TIMEOUT = 120000
const HOOK_TIMEOUT = 300000
const fixCurrentTimeForSchedulerWindow = (iso: string) =>
  vi.spyOn(Date, 'now').mockReturnValue(new Date(iso).getTime())

describe('Scheduler DST (Europe/Dublin) regression', () => {
  let payload: Payload
  let testTenant: { id: number | string; slug: string }
  let user: User
  let eventType: EventType

  const getLocalDateTimeParts = (value: string | Date, timeZone: string) => {
    const zoned = new TZDate(new Date(value), timeZone)
    return {
      year: zoned.getFullYear(),
      month: zoned.getMonth(),
      date: zoned.getDate(),
      hours: zoned.getHours(),
      minutes: zoned.getMinutes(),
    }
  }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const createdTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'DST Tenant',
        slug: `dst-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    testTenant = {
      id: (createdTenant as any).id,
      slug: (createdTenant as any).slug,
    }

    const uniqueEmail = `test-dst-${Date.now()}@test.com`
    user = (await payload.create({
      collection: 'users',
      data: {
        name: 'DST User',
        email: uniqueEmail,
        password: 'test',
        role: ['user'],
        emailVerified: true,
      },
      overrideAccess: true,
    } as any)) as User

    eventType = (await payload.create({
      collection: 'event-types',
      data: {
        name: `DST Class Option ${Date.now()}`,
        places: 10,
        description: 'DST test class option',
        tenant: Number(testTenant.id),
      },
      overrideAccess: true,
    })) as EventType
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db.destroy?.()
    }
  })

  const createCaller = async () => {
    const headers = new Headers()
    headers.set('cookie', `tenant-slug=${testTenant.slug}`)
    const ctx = await createTRPCContext({
      headers,
      payload,
      user,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    })
    return appRouter.createCaller(ctx)
  }

  it(
    'reproduces the DST boundary regression when scheduler is configured on 29th March from a 26th March planning date',
    async () => {
      // 2026 dates are now in the past; updated to 2027. Ireland DST spring boundary:
      // last Sunday of March 2027 = March 28, 2027.
      const nowSpy = fixCurrentTimeForSchedulerWindow('2027-03-29T12:00:00.000Z')

      try {
      const timeZone = 'Europe/Dublin'
      // Simulate scheduler being configured with a start date that sits on the
      // first Monday after DST starts (28 March), while the admin is planning it
      // on 26 March.
      const startDate = '2027-03-28' // Sunday — DST boundary date for 2027
      const endDate = '2027-04-03' // Saturday

      // Keep this to the two active weekdays in the regression scenario:
      // - Monday timeslots at 10:00
      // - Tuesday timeslots at 11:00
      // If Monday is shifted to Sunday, this assertion pattern catches it immediately.
      const hourByScheduleIndex = [10, 11] as const

      const mkSlot = (hour: number) => {
        const start = new TZDate(2000, 0, 1, hour, 0, 0, 0, timeZone)
        const end = new TZDate(2000, 0, 1, hour, 30, 0, 0, timeZone)
        return {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          eventType: eventType.id,
          location: `DST Slot ${hour}`,
          active: true,
        }
      }

      const week = {
        // week.days is Monday-first: 0=Mon ... 6=Sun
        days: [
          { timeSlot: [mkSlot(hourByScheduleIndex[0])] }, // Mon
          { timeSlot: [mkSlot(hourByScheduleIndex[1])] }, // Tue
          { timeSlot: [] }, // Wed
          { timeSlot: [] }, // Thu
          { timeSlot: [] }, // Fri
          { timeSlot: [] }, // Sat
          { timeSlot: [] }, // Sun
        ],
      }

      // Run the generation task directly (synchronously) to avoid the fire-and-forget
      // race condition that arises when creating a scheduler document and waiting for
      // the background job to complete within a fixed timeout.
      await generateTimeslotsFromScheduleWithTenant({
        input: {
          startDate,
          endDate,
          week,
          clearExisting: true,
          defaultEventType: eventType.id,
          lockOutTime: 0,
          tenant: Number(testTenant.id),
        } as any,
        req: { payload, context: { tenant: Number(testTenant.id) } } as any,
        job: {} as any,
      } as any)

      const caller = await createCaller()

      // Query each calendar day using a midday instant in Dublin to avoid boundary ambiguity.
      const calendarDates = [
        { y: 2027, m: 2, d: 28 }, // Sun Mar 28 — DST boundary
        { y: 2027, m: 2, d: 29 }, // Mon Mar 29
        { y: 2027, m: 2, d: 30 }, // Tue Mar 30
        { y: 2027, m: 2, d: 31 }, // Wed Mar 31
        { y: 2027, m: 3, d: 1 },  // Thu Apr 1
        { y: 2027, m: 3, d: 2 },  // Fri Apr 2
        { y: 2027, m: 3, d: 3 },  // Sat Apr 3
      ] as const

      for (const { y, m, d } of calendarDates) {
        const middayInstant = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).toISOString()
        const timeslots = await caller.timeslots.getByDate({
          date: middayInstant,
          tenantId: Number(testTenant.id),
        })

        const jsDay = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).getDay()

        if (jsDay === 0) {
          // Sunday should not get a generated lesson in this schedule
          expect(timeslots.length).toBe(0)
          continue
        }

        if (jsDay >= 3 && jsDay <= 6) {
          // Wednesday through Saturday are intentionally not scheduled in this fixture
          expect(timeslots.length).toBe(0)
          continue
        }

        // Active days Mon/Tue: exactly one lesson each with the configured hour.
        expect(timeslots.length).toBe(1)
        const lesson = timeslots[0]!
        expect(lesson).toBeDefined()
        const start = new TZDate(new Date(lesson.startTime as any), timeZone)

        // Verify lesson is on the correct local calendar day and weekday.
        expect(start.getFullYear()).toBe(y)
        expect(start.getMonth()).toBe(m)
        expect(start.getDate()).toBe(d)

        const scheduleIndex = jsDay === 0 ? 6 : jsDay - 1 // 0=Mon..6=Sun
        const expectedHour = hourByScheduleIndex[scheduleIndex]!
        expect(start.getHours()).toBe(expectedHour)

        if (jsDay === 2) {
          expect(start.getHours()).toBe(11)
        }
        if (jsDay === 1) {
          expect(start.getHours()).toBe(10)
        }
      }

      // 2) If this test is green, Monday is still being created on Monday
      // (not on Sunday) after crossing the DST boundary.
      const mondayTimeslots = await caller.timeslots.getByDate({
        date: new TZDate(2027, 2, 29, 12, 0, 0, 0, timeZone).toISOString(), // Mon Mar 29 2027
        tenantId: Number(testTenant.id),
      })
      expect(mondayTimeslots.length).toBe(1)
      const mondayStart = new TZDate(new Date((mondayTimeslots[0] as any).startTime as any), timeZone)
      expect(mondayStart.getDay()).toBe(1) // Monday
      expect(mondayStart.getHours()).toBe(10)
      expect(mondayStart.getDate()).toBe(29)
      } finally {
        nowSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'handles the Autumn DST boundary in Europe/Dublin without day drift',
    async () => {
      // 2026 dates are now in the past; updated to 2027. Ireland DST autumn boundary:
      // last Sunday of October 2027 = October 31, 2027.
      const nowSpy = fixCurrentTimeForSchedulerWindow('2027-11-01T12:00:00.000Z')

      try {
      const timeZone = 'Europe/Dublin'
      // Simulate a scheduler configured at the start of the autumn fallback window.
      const startDate = '2027-10-31' // Sunday — DST ends this day in 2027
      const endDate = '2027-11-06' // Saturday

      // Keep a narrow schedule for Monday and Tuesday only.
      const hourByScheduleIndex = [9, 10] as const

      const mkSlot = (hour: number) => {
        const start = new TZDate(2000, 0, 1, hour, 0, 0, 0, timeZone)
        const end = new TZDate(2000, 0, 1, hour, 30, 0, 0, timeZone)
        return {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          eventType: eventType.id,
          location: `DST Slot ${hour}`,
          active: true,
        }
      }

      const week = {
        // week.days is Monday-first: 0=Mon ... 6=Sun
        days: [
          { timeSlot: [mkSlot(hourByScheduleIndex[0])] }, // Mon
          { timeSlot: [mkSlot(hourByScheduleIndex[1])] }, // Tue
          { timeSlot: [] }, // Wed
          { timeSlot: [] }, // Thu
          { timeSlot: [] }, // Fri
          { timeSlot: [] }, // Sat
          { timeSlot: [] }, // Sun
        ],
      }

      // Run the generation task directly (synchronously) to avoid the fire-and-forget
      // race condition that arises when creating a scheduler document and waiting for
      // the background job to complete within a fixed timeout.
      await generateTimeslotsFromScheduleWithTenant({
        input: {
          startDate,
          endDate,
          week,
          clearExisting: true,
          defaultEventType: eventType.id,
          lockOutTime: 0,
          tenant: Number(testTenant.id),
        } as any,
        req: { payload, context: { tenant: Number(testTenant.id) } } as any,
        job: {} as any,
      } as any)

      const caller = await createCaller()

      // Query each calendar day using a midday instant in Dublin to avoid boundary ambiguity.
      const calendarDates = [
        { y: 2027, m: 9, d: 31 }, // Sun Oct 31 — DST boundary
        { y: 2027, m: 10, d: 1 }, // Mon Nov 1
        { y: 2027, m: 10, d: 2 }, // Tue Nov 2
        { y: 2027, m: 10, d: 3 }, // Wed Nov 3
        { y: 2027, m: 10, d: 4 }, // Thu Nov 4
        { y: 2027, m: 10, d: 5 }, // Fri Nov 5
        { y: 2027, m: 10, d: 6 }, // Sat Nov 6
      ] as const

      for (const { y, m, d } of calendarDates) {
        const middayInstant = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).toISOString()
        const timeslots = await caller.timeslots.getByDate({
          date: middayInstant,
          tenantId: Number(testTenant.id),
        })

        const jsDay = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).getDay()

        if (jsDay === 0) {
          expect(timeslots.length).toBe(0)
          continue
        }

        if (jsDay >= 3 && jsDay <= 6) {
          expect(timeslots.length).toBe(0)
          continue
        }

        expect(timeslots.length).toBe(1)
        const lesson = timeslots[0]!
        expect(lesson).toBeDefined()
        const start = new TZDate(new Date(lesson.startTime as any), timeZone)

        expect(start.getFullYear()).toBe(y)
        expect(start.getMonth()).toBe(m)
        expect(start.getDate()).toBe(d)

        const scheduleIndex = jsDay === 0 ? 6 : jsDay - 1 // 0=Mon..6=Sun
        const expectedHour = hourByScheduleIndex[scheduleIndex]!
        expect(start.getHours()).toBe(expectedHour)

        if (jsDay === 2) {
          expect(start.getHours()).toBe(10)
        }
        if (jsDay === 1) {
          expect(start.getHours()).toBe(9)
        }
      }

      const mondayTimeslots = await caller.timeslots.getByDate({
        date: new TZDate(2027, 10, 1, 12, 0, 0, 0, timeZone).toISOString(), // Mon Nov 1 2027
        tenantId: Number(testTenant.id),
      })
      expect(mondayTimeslots.length).toBe(1)
      const mondayStart = new TZDate(new Date((mondayTimeslots[0] as any).startTime as any), timeZone)
      expect(mondayStart.getDay()).toBe(1) // Monday
      expect(mondayStart.getHours()).toBe(9)
      expect(mondayStart.getDate()).toBe(1)
      } finally {
        nowSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'preserves lesson date and times when updating a lesson on 30th March across the DST boundary',
    async () => {
      const timeZone = 'Europe/Dublin'

      const lesson = (await payload.create({
        collection: 'timeslots',
        data: {
          tenant: Number(testTenant.id),
          date: new TZDate(2026, 2, 30, 0, 0, 0, 0, timeZone).toISOString(),
          startTime: '10:00',
          endTime: '11:00',
          eventType: eventType.id,
          location: 'DST lesson update regression',
          active: true,
        },
        overrideAccess: true,
      })) as Timeslot

      const beforeDate = getLocalDateTimeParts(String(lesson.date), timeZone)
      const beforeStart = getLocalDateTimeParts(String(lesson.startTime), timeZone)
      const beforeEnd = getLocalDateTimeParts(String(lesson.endTime), timeZone)

      const updated = (await payload.update({
        collection: 'timeslots',
        id: lesson.id,
        data: {
          tenant: Number(testTenant.id),
          date: new Date(String(lesson.date)),
          startTime: new Date(String(lesson.startTime)),
          endTime: new Date(String(lesson.endTime)),
          eventType: eventType.id,
          location: 'DST lesson update regression',
          active: false,
        },
        overrideAccess: true,
      })) as Timeslot

      const afterDate = getLocalDateTimeParts(String(updated.date), timeZone)
      const afterStart = getLocalDateTimeParts(String(updated.startTime), timeZone)
      const afterEnd = getLocalDateTimeParts(String(updated.endTime), timeZone)

      expect(afterDate).toEqual(beforeDate)
      expect(afterStart).toEqual(beforeStart)
      expect(afterEnd).toEqual(beforeEnd)
      expect(afterDate).toMatchObject({ year: 2026, month: 2, date: 30 })
      expect(afterStart.hours).toBe(10)
      expect(afterEnd.hours).toBe(11)
      expect(updated.active).toBe(false)
    },
    TEST_TIMEOUT,
  )
})


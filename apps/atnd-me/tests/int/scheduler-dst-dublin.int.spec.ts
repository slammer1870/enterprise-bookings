import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { ClassOption, Lesson, User } from '@repo/shared-types'
import { createTRPCContext, appRouter } from '@repo/trpc'
import { TZDate } from '@date-fns/tz'

const TEST_TIMEOUT = 120000
const HOOK_TIMEOUT = 300000
const fixCurrentTimeForSchedulerWindow = (iso: string) =>
  vi.spyOn(Date, 'now').mockReturnValue(new Date(iso).getTime())

describe('Scheduler DST (Europe/Dublin) regression', () => {
  let payload: Payload
  let testTenant: { id: number | string; slug: string }
  let user: User
  let classOption: ClassOption

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
        roles: ['user'],
        emailVerified: true,
      },
      overrideAccess: true,
    } as any)) as User

    classOption = (await payload.create({
      collection: 'class-options',
      data: {
        name: `DST Class Option ${Date.now()}`,
        places: 10,
        description: 'DST test class option',
        tenant: Number(testTenant.id),
      },
      overrideAccess: true,
    })) as ClassOption
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
    })
    return appRouter.createCaller(ctx)
  }

  it(
    'reproduces the DST boundary regression when scheduler is configured on 29th March from a 26th March planning date',
    async () => {
      const nowSpy = fixCurrentTimeForSchedulerWindow('2026-03-30T12:00:00.000Z')

      try {
      const timeZone = 'Europe/Dublin'
      // Simulate scheduler being configured with a start date that sits on the
      // first Monday after DST starts (29 March), while the admin is planning it
      // on 26 March.
      const startDate = '2026-03-29' // Sunday in production examples, DST boundary date
      const endDate = '2026-04-04' // Saturday

      // Keep this to the two active weekdays in the regression scenario:
      // - Monday lessons at 10:00
      // - Tuesday lessons at 11:00
      // If Monday is shifted to Sunday, this assertion pattern catches it immediately.
      const hourByScheduleIndex = [10, 11] as const

      const existing = await payload.find({
        collection: 'scheduler',
        where: { tenant: { equals: testTenant.id } },
        limit: 10,
        overrideAccess: true,
      })
      for (const doc of existing.docs) {
        await payload.delete({
          collection: 'scheduler',
          id: doc.id,
          overrideAccess: true,
        })
      }

      const req = {
        ...payload,
        context: { tenant: testTenant.id },
      } as any

      const mkSlot = (hour: number) => {
        const start = new TZDate(2000, 0, 1, hour, 0, 0, 0, timeZone)
        const end = new TZDate(2000, 0, 1, hour, 30, 0, 0, timeZone)
        return {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          classOption: classOption.id,
          location: `DST Slot ${hour}`,
          active: true,
        }
      }

      await payload.create({
        collection: 'scheduler',
        data: {
          tenant: Number(testTenant.id),
          startDate,
          endDate,
          clearExisting: true,
          defaultClassOption: classOption.id,
          lockOutTime: 0,
          week: {
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
          },
        },
        req,
        overrideAccess: true,
      })

      // Job runs synchronously (runByID), but give DB a moment.
      await new Promise((r) => setTimeout(r, 2000))

      const caller = await createCaller()

      // Query each calendar day using a midday instant in Dublin to avoid boundary ambiguity.
      const calendarDates = [
        { y: 2026, m: 2, d: 29 }, // Sun Mar 29
        { y: 2026, m: 2, d: 30 }, // Mon Mar 30
        { y: 2026, m: 2, d: 31 }, // Tue Mar 31
        { y: 2026, m: 3, d: 1 }, // Wed Apr 1
        { y: 2026, m: 3, d: 2 }, // Thu Apr 2
        { y: 2026, m: 3, d: 3 }, // Fri Apr 3
        { y: 2026, m: 3, d: 4 }, // Sat Apr 4
      ] as const

      for (const { y, m, d } of calendarDates) {
        const middayInstant = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).toISOString()
        const lessons = await caller.lessons.getByDate({
          date: middayInstant,
          tenantId: Number(testTenant.id),
        })

        const jsDay = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).getDay()

        if (jsDay === 0) {
          // Sunday should not get a generated lesson in this schedule
          expect(lessons.length).toBe(0)
          continue
        }

        if (jsDay >= 3 && jsDay <= 6) {
          // Wednesday through Saturday are intentionally not scheduled in this fixture
          expect(lessons.length).toBe(0)
          continue
        }

        // Active days Mon/Tue: exactly one lesson each with the configured hour.
        expect(lessons.length).toBe(1)
        const lesson = lessons[0]!
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
      const mondayLessons = await caller.lessons.getByDate({
        date: new TZDate(2026, 2, 30, 12, 0, 0, 0, timeZone).toISOString(),
        tenantId: Number(testTenant.id),
      })
      expect(mondayLessons.length).toBe(1)
      const mondayStart = new TZDate(new Date((mondayLessons[0] as any).startTime as any), timeZone)
      expect(mondayStart.getDay()).toBe(1) // Monday
      expect(mondayStart.getHours()).toBe(10)
      expect(mondayStart.getDate()).toBe(30)
      } finally {
        nowSpy.mockRestore()
      }
    },
    TEST_TIMEOUT,
  )

  it(
    'handles the Autumn DST boundary in Europe/Dublin without day drift',
    async () => {
      const nowSpy = fixCurrentTimeForSchedulerWindow('2026-10-26T12:00:00.000Z')

      try {
      const timeZone = 'Europe/Dublin'
      // Simulate a scheduler configured at the start of the autumn fallback window.
      const startDate = '2026-10-25' // Sunday in production examples, DST ends this weekend
      const endDate = '2026-10-31' // Saturday

      // Keep a narrow schedule for Monday and Tuesday only.
      const hourByScheduleIndex = [9, 10] as const

      const existing = await payload.find({
        collection: 'scheduler',
        where: { tenant: { equals: testTenant.id } },
        limit: 10,
        overrideAccess: true,
      })
      for (const doc of existing.docs) {
        await payload.delete({
          collection: 'scheduler',
          id: doc.id,
          overrideAccess: true,
        })
      }

      const req = {
        ...payload,
        context: { tenant: testTenant.id },
      } as any

      const mkSlot = (hour: number) => {
        const start = new TZDate(2000, 0, 1, hour, 0, 0, 0, timeZone)
        const end = new TZDate(2000, 0, 1, hour, 30, 0, 0, timeZone)
        return {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          classOption: classOption.id,
          location: `DST Slot ${hour}`,
          active: true,
        }
      }

      await payload.create({
        collection: 'scheduler',
        data: {
          tenant: Number(testTenant.id),
          startDate,
          endDate,
          clearExisting: true,
          defaultClassOption: classOption.id,
          lockOutTime: 0,
          week: {
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
          },
        },
        req,
        overrideAccess: true,
      })

      await new Promise((r) => setTimeout(r, 2000))

      const caller = await createCaller()

      // Query each calendar day using a midday instant in Dublin to avoid boundary ambiguity.
      const calendarDates = [
        { y: 2026, m: 9, d: 25 }, // Sun Oct 25
        { y: 2026, m: 9, d: 26 }, // Mon Oct 26
        { y: 2026, m: 9, d: 27 }, // Tue Oct 27
        { y: 2026, m: 9, d: 28 }, // Wed Oct 28
        { y: 2026, m: 9, d: 29 }, // Thu Oct 29
        { y: 2026, m: 9, d: 30 }, // Fri Oct 30
        { y: 2026, m: 9, d: 31 }, // Sat Oct 31
      ] as const

      for (const { y, m, d } of calendarDates) {
        const middayInstant = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).toISOString()
        const lessons = await caller.lessons.getByDate({
          date: middayInstant,
          tenantId: Number(testTenant.id),
        })

        const jsDay = new TZDate(y, m, d, 12, 0, 0, 0, timeZone).getDay()

        if (jsDay === 0) {
          expect(lessons.length).toBe(0)
          continue
        }

        if (jsDay >= 3 && jsDay <= 6) {
          expect(lessons.length).toBe(0)
          continue
        }

        expect(lessons.length).toBe(1)
        const lesson = lessons[0]!
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

      const mondayLessons = await caller.lessons.getByDate({
        date: new TZDate(2026, 9, 26, 12, 0, 0, 0, timeZone).toISOString(),
        tenantId: Number(testTenant.id),
      })
      expect(mondayLessons.length).toBe(1)
      const mondayStart = new TZDate(new Date((mondayLessons[0] as any).startTime as any), timeZone)
      expect(mondayStart.getDay()).toBe(1) // Monday
      expect(mondayStart.getHours()).toBe(9)
      expect(mondayStart.getDate()).toBe(26)
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
        collection: 'lessons',
        data: {
          tenant: Number(testTenant.id),
          date: new TZDate(2026, 2, 30, 0, 0, 0, 0, timeZone).toISOString(),
          startTime: '10:00',
          endTime: '11:00',
          classOption: classOption.id,
          location: 'DST lesson update regression',
          active: true,
        },
        overrideAccess: true,
      })) as Lesson

      const beforeDate = getLocalDateTimeParts(String(lesson.date), timeZone)
      const beforeStart = getLocalDateTimeParts(String(lesson.startTime), timeZone)
      const beforeEnd = getLocalDateTimeParts(String(lesson.endTime), timeZone)

      const updated = (await payload.update({
        collection: 'lessons',
        id: lesson.id,
        data: {
          tenant: Number(testTenant.id),
          date: new Date(String(lesson.date)),
          startTime: new Date(String(lesson.startTime)),
          endTime: new Date(String(lesson.endTime)),
          classOption: classOption.id,
          location: 'DST lesson update regression',
          active: false,
        },
        overrideAccess: true,
      })) as Lesson

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


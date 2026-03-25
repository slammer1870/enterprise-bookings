import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { ClassOption, Lesson, User } from '@repo/shared-types'
import { createTRPCContext, appRouter } from '@repo/trpc'
import { TZDate } from '@date-fns/tz'

const TEST_TIMEOUT = 120000
const HOOK_TIMEOUT = 300000

describe('Scheduler DST (Europe/Dublin) regression', () => {
  let payload: Payload
  let testTenant: { id: number | string; slug: string }
  let user: User
  let classOption: ClassOption

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    testTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'DST Tenant',
        slug: `dst-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })

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
    'does not show Monday schedule on Sunday Mar 29 2026 (Dublin DST start)',
    async () => {
      const timeZone = 'Europe/Dublin'

      // Start schedule on Sunday Mar 29 2026 (DST start day in Dublin).
      const startDate = new TZDate(2026, 2, 29, 0, 0, 0, 0, timeZone)
      const endDate = new TZDate(2026, 3, 2, 23, 59, 59, 999, timeZone) // through Tue Apr 2

      // Use "wall-clock" 10:00-11:00 slot representation.
      const slotStart = new TZDate(2000, 0, 1, 10, 0, 0, 0, timeZone)
      const slotEnd = new TZDate(2000, 0, 1, 11, 0, 0, 0, timeZone)

      // Remove any existing scheduler doc for this tenant to avoid interference.
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

      await payload.create({
        collection: 'scheduler',
        data: {
          tenant: Number(testTenant.id),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          clearExisting: true,
          defaultClassOption: classOption.id,
          lockOutTime: 0,
          week: {
            days: [
              // Monday (index 0)
              {
                timeSlot: [
                  {
                    startTime: slotStart.toISOString(),
                    endTime: slotEnd.toISOString(),
                    classOption: classOption.id,
                    location: 'Test Location',
                    active: true,
                  },
                ],
              },
              // Tuesday (index 1)
              {
                timeSlot: [
                  {
                    startTime: slotStart.toISOString(),
                    endTime: slotEnd.toISOString(),
                    classOption: classOption.id,
                    location: 'Test Location',
                    active: true,
                  },
                ],
              },
              // Wed..Sun empty
              { timeSlot: [] },
              { timeSlot: [] },
              { timeSlot: [] },
              { timeSlot: [] },
              { timeSlot: [] },
            ],
          },
        },
        req,
        overrideAccess: true,
      })

      // Job runs synchronously (runByID), but give DB a moment.
      await new Promise((r) => setTimeout(r, 2000))

      const caller = await createCaller()

      // Query Sunday Mar 29 in Dublin. Use a midday instant to avoid boundary ambiguity.
      const sundayInstant = new TZDate(2026, 2, 29, 12, 0, 0, 0, timeZone).toISOString()
      const sundayLessons = (await caller.lessons.getByDate({
        date: sundayInstant,
        tenantId: Number(testTenant.id),
      })) as Lesson[]

      expect(sundayLessons.length).toBe(0)

      // Query Monday Mar 30 in Dublin - should have at least one lesson.
      const mondayInstant = new TZDate(2026, 2, 30, 12, 0, 0, 0, timeZone).toISOString()
      const mondayLessons = (await caller.lessons.getByDate({
        date: mondayInstant,
        tenantId: Number(testTenant.id),
      })) as Lesson[]

      expect(mondayLessons.length).toBeGreaterThan(0)

      // Ensure lessons returned for Monday are actually Monday in Dublin.
      for (const lesson of mondayLessons) {
        const start = new TZDate(new Date(lesson.startTime as any), timeZone)
        expect(start.getDay()).toBe(1) // 1 = Monday
      }
    },
    TEST_TIMEOUT,
  )
})


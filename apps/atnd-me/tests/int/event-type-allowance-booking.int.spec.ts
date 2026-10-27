/**
 * Booking-path coverage for shared event-type allowances.
 * Unit tests cover the arithmetic. These tests book through tRPC and read the
 * balances the booking page returns.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext, appRouter } from '@repo/trpc'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import type { User } from '@repo/shared-types'

const TEST_TIMEOUT = 120000
const HOOK_TIMEOUT = 300000
const runId = Math.random().toString(36).slice(2, 10)

type Caller = ReturnType<typeof appRouter.createCaller>

describe('Shared event-type allowances through booking', () => {
  let payload: Payload
  let member: User
  let otherMember: User
  let passHolder: User
  let tenantId: number
  let otherTenantId: number
  let beginnersId: number
  let fundamentalsId: number
  let saunaPeakId: number
  let saunaOffPeakId: number
  let pilatesId: number
  const createdTimeslotIds: number[] = []
  const createdBookingIds: number[] = []

  const callerFor = async (user: User, slug: string): Promise<Caller> => {
    const headers = new Headers()
    headers.set('cookie', `tenant-slug=${slug}`)
    const ctx = await createTRPCContext({
      headers,
      payload,
      user,
      bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
    })
    return appRouter.createCaller(ctx)
  }

  const lessonDay = (): Date => {
    const day = new Date()
    day.setDate(day.getDate() + 1)
    day.setHours(0, 0, 0, 0)
    return day
  }

  const createTimeslot = async (
    eventTypeId: number,
    hour: number,
    tenant: number,
    day = lessonDay(),
  ): Promise<number> => {
    const start = new Date(day)
    start.setHours(hour, 0, 0, 0)
    const end = new Date(start)
    end.setHours(hour + 1, 0, 0, 0)
    const timeslot = await payload.create({
      collection: 'timeslots',
      data: {
        tenant,
        eventType: eventTypeId,
        date: start.toISOString(),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location: 'Studio',
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    const id = timeslot.id as number
    createdTimeslotIds.push(id)
    return id
  }

  const remaining = async (caller: Caller, timeslotId: number): Promise<number | null> => {
    const view = await caller.subscriptions.getSubscriptionForTimeslot({ timeslotId })
    return view.remainingSessions
  }

  const creditsFor = async (
    caller: Caller,
    timeslotId: number,
    passId: number,
  ): Promise<number | null> => {
    const passes = (await caller.bookings.getValidClassPassesForTimeslot({
      timeslotId,
      quantity: 1,
    })) as Array<{ id?: number; creditsForEventType?: number }>
    const pass = passes.find((entry) => entry.id === passId)
    return pass?.creditsForEventType ?? null
  }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: `Allowance ${runId}`,
        slug: `allowance-${runId}`,
        stripeConnectAccountId: `acct_allowance_${runId}`,
        stripeConnectOnboardingStatus: 'active',
        refundPolicy: { defaultWindowHours: 1 },
      },
      overrideAccess: true,
    })
    tenantId = tenant.id as number

    const otherTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: `Allowance other ${runId}`,
        slug: `allowance-other-${runId}`,
        refundPolicy: { defaultWindowHours: 1 },
      },
      overrideAccess: true,
    })
    otherTenantId = otherTenant.id as number

    const makeUser = async (label: string) =>
      (await payload.create({
        collection: 'users',
        data: {
          name: label,
          email: `${label}-${runId}@test.com`,
          password: 'test',
          role: ['user'],
          emailVerified: true,
        },
        draft: false,
        overrideAccess: true,
      } as Parameters<typeof payload.create>[0])) as User

    member = await makeUser('member')
    otherMember = await makeUser('other-member')
    passHolder = await makeUser('pass-holder')

    const makeEventType = async (name: string, tenant: number) => {
      const doc = await payload.create({
        collection: 'event-types',
        data: { name: `${name} ${runId}`, places: 10, description: name, tenant },
        overrideAccess: true,
      })
      return doc.id as number
    }

    beginnersId = await makeEventType('Yoga Beginners', tenantId)
    fundamentalsId = await makeEventType('Yoga Fundamentals', tenantId)
    saunaPeakId = await makeEventType('Sauna Peak', tenantId)
    saunaOffPeakId = await makeEventType('Sauna Off-peak', tenantId)
    pilatesId = await makeEventType('Pilates', tenantId)
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (!payload?.db) return
    const drop = async (collection: string, where: Record<string, unknown>) => {
      await payload.delete({ collection: collection as 'bookings', where, overrideAccess: true }).catch(() => undefined)
    }
    if (createdBookingIds.length > 0) {
      await drop('bookings', { id: { in: createdBookingIds } })
    }
    if (createdTimeslotIds.length > 0) {
      await drop('timeslots', { id: { in: createdTimeslotIds } })
    }
    await drop('subscriptions', { user: { in: [member.id, otherMember.id, passHolder.id] } })
    await drop('class-passes', { user: { in: [member.id, otherMember.id, passHolder.id] } })
    await drop('plans', { tenant: { equals: tenantId } })
    await drop('class-pass-types', { tenant: { equals: tenantId } })
    await drop('event-types', { tenant: { in: [tenantId, otherTenantId] } })
    await drop('users', { id: { in: [member.id, otherMember.id, passHolder.id] } })
    await drop('tenants', { id: { in: [tenantId, otherTenantId] } })
    await payload.db.destroy?.()
  }, HOOK_TIMEOUT)

  it(
    'shares a weekly membership pool across two classes, leaves the other balances, and counts those bookings in Sessions once the row is removed',
    async () => {
      const allowedEventTypes = [beginnersId, fundamentalsId, saunaPeakId, saunaOffPeakId, pilatesId]
      const yogaRow = (sessions: number) => ({
        eventTypes: [beginnersId, fundamentalsId],
        sessions,
        interval: 'week' as const,
        intervalCount: 1,
        maxBookingsPerTimeslot: 1,
      })
      const saunaRow = {
        eventTypes: [saunaPeakId, saunaOffPeakId],
        sessions: 2,
        interval: 'week' as const,
        intervalCount: 1,
      }
      const makePlan = async (name: string, sessions: number, yogaSessions: number) => {
        const plan = await payload.create({
          collection: 'plans',
          data: {
            name: `${name} ${runId}`,
            status: 'active',
            tenant: tenantId,
            allowedEventTypes,
            sessionsInformation: {
              sessions,
              interval: 'month',
              intervalCount: 1,
              eventTypeOverrides: [yogaRow(yogaSessions), saunaRow],
            },
          },
          overrideAccess: true,
        })
        return plan.id as number
      }

      const planId = await makePlan('8 a month', 8, 2)
      const higherYogaId = await makePlan('yoga 4 a week', 8, 4)
      const higherMonthId = await makePlan('12 a month', 12, 2)

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 60)
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 60)
      const subscribe = async (userId: number) => {
        const sub = await payload.create({
          collection: 'subscriptions',
          data: {
            user: userId,
            plan: planId,
            status: 'active',
            tenant: tenantId,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          overrideAccess: true,
        })
        return sub.id as number
      }
      const subscriptionId = await subscribe(member.id)
      await subscribe(otherMember.id)

      const day = lessonDay()
      const beginners = await createTimeslot(beginnersId, 10, tenantId, day)
      const fundamentals = await createTimeslot(fundamentalsId, 11, tenantId, day)
      const sauna = await createTimeslot(saunaPeakId, 12, tenantId, day)
      const saunaOffPeak = await createTimeslot(saunaOffPeakId, 15, tenantId, day)
      const pilates = await createTimeslot(pilatesId, 13, tenantId, day)
      const anotherBeginners = await createTimeslot(beginnersId, 14, tenantId, day)

      const pastDay = new Date(day)
      pastDay.setDate(pastDay.getDate() - 40)
      const pastSlot = await createTimeslot(beginnersId, 10, tenantId, pastDay)
      const pastBooking = await payload.create({
        collection: 'bookings',
        data: {
          user: member.id,
          timeslot: pastSlot,
          tenant: tenantId,
          status: 'confirmed',
        },
        overrideAccess: true,
      })
      createdBookingIds.push(pastBooking.id as number)

      const caller = await callerFor(member, `allowance-${runId}`)
      const book = async (timeslotId: number, quantity = 1) => {
        const created = await caller.bookings.createBookings({
          timeslotId,
          quantity,
          subscriptionId,
        })
        for (const booking of created) createdBookingIds.push(booking.id as number)
        return created
      }

      expect(await remaining(caller, beginners)).toBe(2)
      expect(await remaining(caller, fundamentals)).toBe(2)
      expect(await remaining(caller, pilates)).toBe(8)
      expect(await remaining(caller, sauna)).toBe(2)

      await expect(book(beginners, 2)).rejects.toThrow(/1 more slot for this timeslot/i)
      expect(await remaining(caller, beginners)).toBe(2)

      const beginnersBooking = await book(beginners)
      expect(await remaining(caller, beginners)).toBe(1)
      expect(await remaining(caller, fundamentals)).toBe(1)
      expect(await remaining(caller, pilates)).toBe(8)
      expect(await remaining(caller, sauna)).toBe(2)
      expect(await remaining(caller, saunaOffPeak)).toBe(2)

      await book(fundamentals)
      expect(await remaining(caller, beginners)).toBe(0)
      expect(await remaining(caller, fundamentals)).toBe(0)
      expect(await remaining(caller, pilates)).toBe(8)
      expect(await remaining(caller, sauna)).toBe(2)
      expect(await remaining(caller, saunaOffPeak)).toBe(2)

      await expect(book(anotherBeginners)).rejects.toThrow(/session limit/i)

      const yogaView = await caller.subscriptions.getSubscriptionForTimeslot({
        timeslotId: anotherBeginners,
      })
      expect(yogaView.subscriptionLimitReached).toBe(true)
      expect(yogaView.upgradeOptions.map((option) => option.plan.id)).toEqual([higherYogaId])
      expect(yogaView.upgradeOptions[0]?.maxAdditionalSessions).toBe(2)
      expect(yogaView.upgradeOptions.some((option) => option.plan.id === higherMonthId)).toBe(false)

      const pilatesView = await caller.subscriptions.getSubscriptionForTimeslot({
        timeslotId: pilates,
      })
      expect(pilatesView.remainingSessions).toBe(8)
      expect(pilatesView.subscriptionLimitReached).toBe(false)
      expect(pilatesView.upgradeOptions).toEqual([])

      const otherCaller = await callerFor(otherMember, `allowance-${runId}`)
      expect(await remaining(otherCaller, beginners)).toBe(2)

      const otherEventType = await payload.create({
        collection: 'event-types',
        data: {
          name: `Other tenant class ${runId}`,
          places: 10,
          description: 'Other',
          tenant: otherTenantId,
        },
        overrideAccess: true,
      })
      const otherSlot = await createTimeslot(otherEventType.id as number, 10, otherTenantId, day)
      const otherTenantCaller = await callerFor(member, `allowance-other-${runId}`)
      const otherTenantView = await otherTenantCaller.subscriptions.getSubscriptionForTimeslot({
        timeslotId: otherSlot,
      })
      expect(otherTenantView.subscription).toBeNull()

      expect(await remaining(caller, anotherBeginners)).toBe(0)

      await payload.update({
        collection: 'plans',
        id: planId,
        data: {
          sessionsInformation: {
            sessions: 8,
            interval: 'month',
            intervalCount: 1,
            eventTypeOverrides: [saunaRow],
          },
        },
        overrideAccess: true,
      })

      expect(await remaining(caller, beginners)).toBe(6)
      expect(await remaining(caller, fundamentals)).toBe(6)
      expect(await remaining(caller, pilates)).toBe(6)
      expect(await remaining(caller, sauna)).toBe(2)

      await caller.bookings.cancelBooking({ id: beginnersBooking[0]!.id as number })
      expect(await remaining(caller, beginners)).toBe(7)
      expect(await remaining(caller, pilates)).toBe(7)
      expect(await remaining(caller, sauna)).toBe(2)
      expect(await remaining(caller, saunaOffPeak)).toBe(2)
    },
    TEST_TIMEOUT,
  )

  it(
    'shares a class-pass credit row across two classes, keeps that balance when the type changes, and restores it on cancel',
    async () => {
      const passType = await payload.create({
        collection: 'class-pass-types',
        data: {
          name: `Shared pass ${runId}`,
          quantity: 10,
          daysUntilExpiration: 30,
          tenant: tenantId,
          status: 'active',
          maxBookingsPerTimeslot: null,
          skipSync: true,
          allowedEventTypes: [beginnersId, fundamentalsId, saunaPeakId, pilatesId],
          eventTypeOverrides: [
            {
              eventTypes: [beginnersId, fundamentalsId],
              quantity: 4,
              maxBookingsPerTimeslot: 2,
            },
            { eventTypes: [saunaPeakId], quantity: 1 },
          ],
        },
        overrideAccess: true,
      })

      const future = new Date()
      future.setDate(future.getDate() + 30)
      const issuePass = async () => {
        const pass = await payload.create({
          collection: 'class-passes',
          data: {
            user: passHolder.id,
            tenant: tenantId,
            type: passType.id,
            quantity: 10,
            expirationDate: future.toISOString(),
            purchasedAt: new Date().toISOString(),
            status: 'active',
          },
          overrideAccess: true,
        })
        return pass.id as number
      }
      const passId = await issuePass()

      const day = lessonDay()
      const beginners = await createTimeslot(beginnersId, 16, tenantId, day)
      const fundamentals = await createTimeslot(fundamentalsId, 17, tenantId, day)
      const sauna = await createTimeslot(saunaPeakId, 18, tenantId, day)
      const pilates = await createTimeslot(pilatesId, 19, tenantId, day)
      const caller = await callerFor(passHolder, `allowance-${runId}`)

      expect(await creditsFor(caller, beginners, passId)).toBe(4)
      expect(await creditsFor(caller, fundamentals, passId)).toBe(4)
      expect(await creditsFor(caller, pilates, passId)).toBe(10)
      expect(await creditsFor(caller, sauna, passId)).toBe(1)

      const booked = await caller.bookings.createBookings({
        timeslotId: beginners,
        quantity: 1,
        classPassId: passId,
      })
      createdBookingIds.push(booked[0]!.id as number)

      expect(await creditsFor(caller, beginners, passId)).toBe(3)
      expect(await creditsFor(caller, fundamentals, passId)).toBe(3)
      expect(await creditsFor(caller, pilates, passId)).toBe(10)
      expect(await creditsFor(caller, sauna, passId)).toBe(1)

      const saunaBooking = await caller.bookings.createBookings({
        timeslotId: sauna,
        quantity: 1,
        classPassId: passId,
      })
      createdBookingIds.push(saunaBooking[0]!.id as number)
      expect(await creditsFor(caller, sauna, passId)).toBe(0)
      expect(await creditsFor(caller, beginners, passId)).toBe(3)
      expect(await creditsFor(caller, pilates, passId)).toBe(10)

      await caller.bookings.cancelBooking({ id: booked[0]!.id as number })
      expect(await creditsFor(caller, beginners, passId)).toBe(4)
      expect(await creditsFor(caller, fundamentals, passId)).toBe(4)
      expect(await creditsFor(caller, pilates, passId)).toBe(10)
      expect(await creditsFor(caller, sauna, passId)).toBe(0)

      await payload.update({
        collection: 'class-pass-types',
        id: passType.id,
        data: {
          eventTypeOverrides: [
            {
              eventTypes: [beginnersId, fundamentalsId],
              quantity: 9,
              maxBookingsPerTimeslot: 1,
            },
            { eventTypes: [saunaPeakId], quantity: 1 },
          ],
        },
        overrideAccess: true,
      })

      expect(await creditsFor(caller, beginners, passId)).toBe(4)
      const laterPassId = await issuePass()
      expect(await creditsFor(caller, beginners, laterPassId)).toBe(9)
      expect(await creditsFor(caller, beginners, passId)).toBe(4)

      const passes = (await caller.bookings.getValidClassPassesForTimeslot({
        timeslotId: beginners,
        quantity: 1,
      })) as Array<{ id?: number; type?: { maxBookingsPerTimeslot?: number | null } }>
      const original = passes.find((entry) => entry.id === passId)
      expect(original?.type?.maxBookingsPerTimeslot).toBe(1)

      const stranger = await callerFor(otherMember, `allowance-${runId}`)
      expect(await creditsFor(stranger, beginners, passId)).toBeNull()
    },
    TEST_TIMEOUT,
  )
})

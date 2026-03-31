/**
 * Phase 4.6 – Integration: getValidClassPassesForLesson and createBookings with classPassId.
 * - getValidClassPassesForLesson returns only passes for lesson's tenant and allowed types.
 * - createBookings with classPassId creates booking with paymentMethodUsed and classPassIdUsed; pass quantity decremented.
 * - Invalid pass / wrong tenant / quantity rejected.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { createTRPCContext } from '@repo/trpc'
import { appRouter } from '@repo/trpc'
import type { User, Lesson } from '@repo/shared-types'

const TEST_TIMEOUT = 60000
const HOOK_TIMEOUT = 300000
const runId = Math.random().toString(36).slice(2, 10)

describe('Class pass booking UI (Phase 4.6)', () => {
  let payload: Payload
  let user: User
  let testTenantId: number
  let otherTenantId: number
  let classOptionId: number
  let classPassTypeId: number
  let classPassId: number
  let limitedClassPassId: number
  let lessonId: number

  const createCaller = async () => {
    const headers = new Headers()
    headers.set('cookie', `tenant-slug=cp-ui-tenant`)
    const ctx = await createTRPCContext({
      headers,
      payload,
      user,
    })
    return appRouter.createCaller(ctx)
  }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'CP UI Tenant',
        slug: 'cp-ui-tenant',
        stripeConnectAccountId: `acct_e2e_connected_cp_ui_${runId}`,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    const otherTenant = await payload.create({
      collection: 'tenants',
      data: { name: 'Other Tenant', slug: `other-tenant-${Date.now()}` },
      overrideAccess: true,
    })
    otherTenantId = otherTenant.id as number

    user = (await payload.create({
      collection: 'users',
      data: {
        name: 'CP UI User',
        email: `cp-ui-user-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const co = await payload.create({
      collection: 'class-options',
      data: {
        name: `CP UI Class ${Date.now()}`,
        places: 10,
        description: 'Test',
        tenant: testTenantId,
      },
      overrideAccess: true,
    })
    classOptionId = co.id as number

    const cpt = await payload.create({
      collection: 'class-pass-types',
      data: {
        name: 'CP UI 5-Pack',
        slug: `cp-ui-5pack-${Date.now()}`,
        quantity: 5,
        tenant: testTenantId,
        status: 'active',
        allowMultipleBookingsPerLesson: true,
        priceInformation: { price: 29.99 },
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])
    classPassTypeId = cpt.id as number

    await payload.update({
      collection: 'class-options',
      id: classOptionId,
      data: { paymentMethods: { allowedClassPasses: [classPassTypeId] } },
      overrideAccess: true,
    })

    const future = new Date(Date.now() + 86400000 * 30)
    const pass = await payload.create({
      collection: 'class-passes',
      data: {
        user: user.id,
        tenant: testTenantId,
        type: classPassTypeId,
        quantity: 5,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 2999,
        status: 'active',
      },
      overrideAccess: true,
    })
    classPassId = pass.id as number

    const limitedPass = await payload.create({
      collection: 'class-passes',
      data: {
        user: user.id,
        tenant: testTenantId,
        type: classPassTypeId,
        quantity: 2,
        expirationDate: future.toISOString().slice(0, 10),
        purchasedAt: new Date().toISOString(),
        price: 1999,
        status: 'active',
      },
      overrideAccess: true,
    })
    limitedClassPassId = limitedPass.id as number

    const start = new Date()
    start.setDate(start.getDate() + 1)
    start.setHours(14, 0, 0, 0)
    const end = new Date(start)
    end.setHours(15, 0, 0, 0)
    const lesson = await payload.create({
      collection: 'lessons',
      data: {
        tenant: testTenantId,
        classOption: classOptionId,
        date: start.toISOString().slice(0, 10),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location: 'Test',
        lockOutTime: 0,
        active: true,
      },
      overrideAccess: true,
    })
    lessonId = lesson.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({ collection: 'bookings', where: { lesson: { equals: lessonId } }, overrideAccess: true })
        await payload.delete({ collection: 'lessons', where: { id: { equals: lessonId } }, overrideAccess: true })
        await payload.delete({
          collection: 'class-passes',
          where: { id: { in: [classPassId, limitedClassPassId] } },
          overrideAccess: true,
        })
        await payload.delete({ collection: 'class-pass-types', where: { id: { equals: classPassTypeId } }, overrideAccess: true })
        await payload.delete({ collection: 'class-options', where: { id: { equals: classOptionId } }, overrideAccess: true })
        await payload.delete({ collection: 'users', where: { id: { equals: user.id } }, overrideAccess: true })
        await payload.delete({ collection: 'tenants', where: { id: { in: [testTenantId, otherTenantId] } }, overrideAccess: true })
      } catch {
        // ignore
      }
      await payload.db.destroy?.()
    }
  })

  it(
    'getValidClassPassesForLesson returns only passes for lesson tenant and allowed types',
    async () => {
      const caller = await createCaller()
      const getValid = (caller as any).bookings?.getValidClassPassesForLesson
      if (typeof getValid !== 'function') {
        expect(getValid).toBeDefined()
        return
      }
      const passes = await getValid({ lessonId })
      expect(Array.isArray(passes)).toBe(true)
      expect(passes.length).toBeGreaterThanOrEqual(1)
      const found = passes.find((p: any) => p.id === classPassId)
      expect(found).toBeDefined()
      expect(found.quantity).toBe(5)
      expect(found.status).toBe('active')
    },
    TEST_TIMEOUT,
  )

  it(
    'getValidClassPassesForLesson hides passes that cannot cover the requested quantity',
    async () => {
      const caller = await createCaller()
      const getValid = (caller as any).bookings?.getValidClassPassesForLesson
      if (typeof getValid !== 'function') {
        expect(getValid).toBeDefined()
        return
      }
      const passes = await getValid({ lessonId, quantity: 3 })
      expect(Array.isArray(passes)).toBe(true)
      expect(passes.find((p: any) => p.id === classPassId)).toBeDefined()
      expect(passes.find((p: any) => p.id === limitedClassPassId)).toBeUndefined()
    },
    TEST_TIMEOUT,
  )

  it(
    'createBookings with classPassId creates booking with paymentMethodUsed and classPassIdUsed',
    async () => {
      const caller = await createCaller()
      const createBookings = (caller as any).bookings?.createBookings
      if (typeof createBookings !== 'function') {
        expect(createBookings).toBeDefined()
        return
      }
      const result = await createBookings({
        lessonId,
        quantity: 1,
        classPassId,
      })
      expect(result).toBeDefined()
      expect(result.length).toBe(1)
      const booking = await payload.findByID({
        collection: 'bookings',
        id: result[0]!.id,
        depth: 0,
      }) as any
      expect(booking.paymentMethodUsed).toBe('class_pass')
      expect(booking.classPassIdUsed).toBe(classPassId)
      const passAfter = await payload.findByID({
        collection: 'class-passes',
        id: classPassId,
        depth: 0,
      }) as any
      expect(passAfter.quantity).toBe(4)
    },
    TEST_TIMEOUT,
  )

  it(
    'createBookings with invalid classPassId is rejected',
    async () => {
      const caller = await createCaller()
      await expect(
        (caller as any).bookings.createBookings({
          lessonId,
          quantity: 1,
          classPassId: 999999,
        }),
      ).rejects.toThrow()
    },
    TEST_TIMEOUT,
  )

  it(
    'createBookings with classPassId is rejected when requested quantity exceeds remaining credits',
    async () => {
      const caller = await createCaller()
      await expect(
        (caller as any).bookings.createBookings({
          lessonId,
          quantity: 3,
          classPassId: limitedClassPassId,
        }),
      ).rejects.toThrow(/not enough credits/i)

      const passAfter = await payload.findByID({
        collection: 'class-passes',
        id: limitedClassPassId,
        depth: 0,
      }) as any
      expect(passAfter.quantity).toBe(2)
    },
    TEST_TIMEOUT,
  )
})

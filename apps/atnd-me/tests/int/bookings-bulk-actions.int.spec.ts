/**
 * Phase 5: Admin Bookings Bulk Operations
 * Integration tests for bulk update status and bulk delete with tenant scope.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload, type CollectionSlug } from 'payload'
import config from '../../src/payload.config'
import type { User, Tenant, Lesson, ClassOption, Booking } from '@repo/shared-types'

const TEST_TIMEOUT = 60000
const HOOK_TIMEOUT = 300000

describe('Bookings bulk actions', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let tenant1: Tenant
  let tenant2: Tenant
  let lesson1: Lesson
  let lesson2: Lesson
  let booking1: Booking
  let booking2: Booking
  let bookingTenant2: Booking

  const createWithTenantContext = async <T = unknown>(
    collection: CollectionSlug,
    data: Record<string, unknown>,
    tenantId: number | string,
  ): Promise<T> => {
    const req = { ...payload, context: { tenant: tenantId }, user: adminUser } as any
    const dataWithTenant = { ...data, tenant: tenantId }
    return payload.create({
      collection,
      data: dataWithTenant,
      req,
      overrideAccess: true,
    } as any) as Promise<T>
  }

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    tenant1 = (await payload.create({
      collection: 'tenants',
      data: { name: 'Bulk Test Tenant 1', slug: `bulk-tenant-1-${Date.now()}` },
      overrideAccess: true,
    })) as Tenant

    tenant2 = (await payload.create({
      collection: 'tenants',
      data: { name: 'Bulk Test Tenant 2', slug: `bulk-tenant-2-${Date.now()}` },
      overrideAccess: true,
    })) as Tenant

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Bulk Admin',
        email: `bulk-admin-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Bulk Tenant Admin',
        email: `bulk-tenant-admin-${Date.now()}@test.com`,
        password: 'test',
        roles: ['tenant-admin'],
        emailVerified: true,
        tenants: [{ tenant: tenant1.id }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const classOpt1 = (await createWithTenantContext<ClassOption>(
      'class-options',
      { name: 'Bulk Class 1', places: 10, description: 'D' },
      tenant1.id,
    )) as ClassOption
    const classOpt2 = (await createWithTenantContext<ClassOption>(
      'class-options',
      { name: 'Bulk Class 2', places: 10, description: 'D' },
      tenant2.id,
    )) as ClassOption

    const start1 = new Date()
    start1.setHours(10, 0, 0, 0)
    const end1 = new Date(start1)
    end1.setHours(11, 0, 0, 0)
    lesson1 = (await createWithTenantContext<Lesson>('lessons', {
      date: start1.toISOString(),
      startTime: start1.toISOString(),
      endTime: end1.toISOString(),
      classOption: classOpt1.id,
      location: 'L1',
      active: true,
      lockOutTime: 0,
    }, tenant1.id)) as Lesson

    const start2 = new Date()
    start2.setHours(14, 0, 0, 0)
    const end2 = new Date(start2)
    end2.setHours(15, 0, 0, 0)
    lesson2 = (await createWithTenantContext<Lesson>('lessons', {
      date: start2.toISOString(),
      startTime: start2.toISOString(),
      endTime: end2.toISOString(),
      classOption: classOpt2.id,
      location: 'L2',
      active: true,
      lockOutTime: 0,
    }, tenant2.id)) as Lesson

    booking1 = (await createWithTenantContext<Booking>('bookings', {
      user: adminUser.id,
      lesson: lesson1.id,
      status: 'pending',
    }, tenant1.id)) as Booking

    booking2 = (await createWithTenantContext<Booking>('bookings', {
      user: adminUser.id,
      lesson: lesson1.id,
      status: 'confirmed',
    }, tenant1.id)) as Booking

    bookingTenant2 = (await createWithTenantContext<Booking>('bookings', {
      user: adminUser.id,
      lesson: lesson2.id,
      status: 'pending',
    }, tenant2.id)) as Booking
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) await payload.db?.destroy?.()
  })

  describe('bulk update status', () => {
    it(
      'tenant-admin can bulk update status of bookings in their tenant',
      async () => {
        const req = {
          ...payload,
          context: { tenant: tenant1.id },
          user: tenantAdminUser,
        } as any

        const result = await payload.update({
          collection: 'bookings',
          where: { id: { in: [booking1.id, booking2.id] } },
          data: { status: 'cancelled' },
          req,
          overrideAccess: false,
        })

        expect(result.docs).toBeDefined()
        expect(result.docs.length).toBe(2)
        expect(result.docs.every((d) => d.status === 'cancelled')).toBe(true)

        // Restore for other tests
        await payload.update({
          collection: 'bookings',
          where: { id: { in: [booking1.id, booking2.id] } },
          data: { status: 'pending' },
          overrideAccess: true,
        })
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin cannot update bookings from another tenant',
      async () => {
        const req = {
          ...payload,
          context: { tenant: tenant1.id },
          user: tenantAdminUser,
        } as any

        const result = await payload.update({
          collection: 'bookings',
          where: { id: { equals: bookingTenant2.id } },
          data: { status: 'cancelled' },
          req,
          overrideAccess: false,
        })

        expect(result.docs).toBeDefined()
        expect(result.docs.length).toBe(0)
      },
      TEST_TIMEOUT,
    )

    it(
      'super admin can bulk update bookings across tenants',
      async () => {
        const req = { ...payload, user: adminUser } as any

        const result = await payload.update({
          collection: 'bookings',
          where: { id: { in: [booking1.id, bookingTenant2.id] } },
          data: { status: 'waiting' },
          req,
          overrideAccess: false,
        })

        expect(result.docs).toBeDefined()
        expect(result.docs.length).toBe(2)
        expect(result.docs.every((d) => d.status === 'waiting')).toBe(true)
      },
      TEST_TIMEOUT,
    )
  })

  describe('bulk delete', () => {
    let deleteBooking1: Booking
    let deleteBooking2: Booking

    beforeAll(async () => {
      const classOpt = (await payload.find({
        collection: 'class-options',
        where: { tenant: { equals: tenant1.id } },
        limit: 1,
        overrideAccess: true,
      })).docs[0] as ClassOption
      const lesson = (await payload.find({
        collection: 'lessons',
        where: { tenant: { equals: tenant1.id } },
        limit: 1,
        overrideAccess: true,
      })).docs[0] as Lesson
      deleteBooking1 = (await payload.create({
        collection: 'bookings',
        data: {
          user: adminUser.id,
          lesson: lesson.id,
          status: 'pending',
          tenant: tenant1.id,
        },
        overrideAccess: true,
      })) as Booking
      deleteBooking2 = (await payload.create({
        collection: 'bookings',
        data: {
          user: adminUser.id,
          lesson: lesson.id,
          status: 'pending',
          tenant: tenant1.id,
        },
        overrideAccess: true,
      })) as Booking
    }, TEST_TIMEOUT)

    it(
      'tenant-admin can bulk delete bookings in their tenant',
      async () => {
        const req = {
          ...payload,
          context: { tenant: tenant1.id },
          user: tenantAdminUser,
        } as any

        const result = await payload.delete({
          collection: 'bookings',
          where: { id: { in: [deleteBooking1.id, deleteBooking2.id] } },
          req,
          overrideAccess: false,
        })

        expect(result.docs).toBeDefined()
        expect(result.docs.length).toBe(2)

        const stillThere = await payload.find({
          collection: 'bookings',
          where: { id: { in: [deleteBooking1.id, deleteBooking2.id] } },
          limit: 2,
          overrideAccess: true,
        })
        expect(stillThere.docs.length).toBe(0)
      },
      TEST_TIMEOUT,
    )

    it(
      'tenant-admin cannot delete a booking from another tenant',
      async () => {
        const req = {
          ...payload,
          context: { tenant: tenant1.id },
          user: tenantAdminUser,
        } as any

        const result = await payload.delete({
          collection: 'bookings',
          where: { id: { equals: bookingTenant2.id } },
          req,
          overrideAccess: false,
        })

        expect(result.docs).toBeDefined()
        expect(result.docs.length).toBe(0)

        const stillThere = await payload.findByID({
          collection: 'bookings',
          id: bookingTenant2.id,
          overrideAccess: true,
        })
        expect(stillThere).toBeDefined()
        expect(stillThere.id).toBe(bookingTenant2.id)
      },
      TEST_TIMEOUT,
    )

    it(
      'super admin can bulk delete bookings across tenants',
      async () => {
        const toDelete = (await payload.create({
          collection: 'bookings',
          data: {
            user: adminUser.id,
            lesson: lesson1.id,
            status: 'pending',
            tenant: tenant1.id,
          },
          overrideAccess: true,
        })) as Booking
        const toDelete2 = (await payload.create({
          collection: 'bookings',
          data: {
            user: adminUser.id,
            lesson: lesson2.id,
            status: 'pending',
            tenant: tenant2.id,
          },
          overrideAccess: true,
        })) as Booking

        const req = { ...payload, user: adminUser } as any
        const result = await payload.delete({
          collection: 'bookings',
          where: { id: { in: [toDelete.id, toDelete2.id] } },
          req,
          overrideAccess: false,
        })

        expect(result.docs.length).toBe(2)
      },
      TEST_TIMEOUT,
    )
  })

  describe('list view tenant scope', () => {
    it(
      'tenant-admin find bookings only returns their tenant bookings',
      async () => {
        const req = {
          ...payload,
          context: { tenant: tenant1.id },
          user: tenantAdminUser,
        } as any

        const result = await payload.find({
          collection: 'bookings',
          where: {},
          limit: 100,
          req,
          overrideAccess: false,
        })

        const tenantIds = result.docs
          .map((d) => (typeof (d as any).tenant === 'object' ? (d as any).tenant?.id : (d as any).tenant))
          .filter(Boolean)
        const allFromTenant1 = tenantIds.every((tid) => tid === tenant1.id || String(tid) === String(tenant1.id))
        expect(allFromTenant1).toBe(true)
      },
      TEST_TIMEOUT,
    )
  })
})

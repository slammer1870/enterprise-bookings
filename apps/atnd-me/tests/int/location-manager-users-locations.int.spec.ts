/**
 * Phase 7 Chunk 5 — `location-manager` role + `users.locations` assignments (org admin vs self).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User, Tenant } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('location-manager users.locations', () => {
  let payload: Payload
  let tenant: Tenant
  let locA: { id: number }
  let locB: { id: number }
  let orgAdmin: User
  let locationManager: User

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    const ts = Date.now()

    tenant = (await payload.create({
      collection: 'tenants',
      data: { name: 'LM Locations Tenant', slug: `lm-loc-t-${ts}` },
      overrideAccess: true,
    })) as Tenant

    await payload.create({
      collection: 'users',
      data: {
        name: 'Bootstrap super-admin (LM test)',
        email: `bootstrap-lm-loc-${ts}@test.com`,
        password: 'test',
        role: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])

    orgAdmin = (await payload.create({
      collection: 'users',
      data: {
        name: 'Org Admin LM',
        email: `org-lm-loc-${ts}@test.com`,
        password: 'test',
        role: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: tenant.id }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    locA = await payload.create({
      collection: 'locations',
      data: { tenant: tenant.id, name: 'LM Branch A', slug: `lm-br-a-${ts}` },
      overrideAccess: true,
    })

    locB = await payload.create({
      collection: 'locations',
      data: { tenant: tenant.id, name: 'LM Branch B', slug: `lm-br-b-${ts}` },
      overrideAccess: true,
    })

    locationManager = (await payload.create({
      collection: 'users',
      data: {
        name: 'Site Manager',
        email: `lm-user-${ts}@test.com`,
        password: 'test',
        role: ['location-manager'],
        emailVerified: true,
        tenants: [{ tenant: tenant.id }],
        locations: [locA.id],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      await payload.db?.destroy?.()
    }
  })

  it(
    'org admin can read location-manager in tenant scope',
    async () => {
      const req = {
        ...payload,
        user: orgAdmin,
        context: { tenant: tenant.id },
      } as Parameters<typeof payload.find>[0]['req']

      const r = await payload.find({
        collection: 'users',
        where: { id: { equals: locationManager.id } },
        req,
        overrideAccess: false,
        limit: 1,
      })
      expect(r.docs.length).toBe(1)
    },
    TEST_TIMEOUT,
  )

  it(
    'location-manager cannot change their own users.locations (field is stripped, not applied)',
    async () => {
      const req = {
        ...payload,
        user: locationManager,
        context: { tenant: tenant.id },
      } as Parameters<typeof payload.update>[0]['req']

      await payload.update({
        collection: 'users',
        id: locationManager.id,
        data: { locations: [locB.id] },
        req,
        overrideAccess: false,
      })

      const after = await payload.findByID({
        collection: 'users',
        id: locationManager.id,
        req,
        overrideAccess: false,
        depth: 1,
      })
      const locIds = Array.isArray(after.locations)
        ? after.locations.map((x: unknown) =>
            typeof x === 'object' && x !== null && 'id' in x ? (x as { id: number }).id : x,
          )
        : []
      expect(locIds).toEqual([locA.id])
    },
    TEST_TIMEOUT,
  )

  it(
    'org admin can assign and update users.locations for a location-manager',
    async () => {
      const req = {
        ...payload,
        user: orgAdmin,
        context: { tenant: tenant.id },
      } as Parameters<typeof payload.update>[0]['req']

      await payload.update({
        collection: 'users',
        id: locationManager.id,
        data: { locations: [locA.id, locB.id] },
        req,
        overrideAccess: false,
      })

      const fresh = await payload.findByID({
        collection: 'users',
        id: locationManager.id,
        req,
        overrideAccess: false,
        depth: 1,
      })

      const locIds = fresh.locations
      const ids = Array.isArray(locIds)
        ? locIds.map((x: unknown) => (typeof x === 'object' && x !== null && 'id' in x ? (x as { id: number }).id : x))
        : []
      expect(ids).toEqual(expect.arrayContaining([locA.id, locB.id]))
      expect(ids.length).toBe(2)
    },
    TEST_TIMEOUT,
  )

  it(
    'location-manager can update non-sensitive self fields',
    async () => {
      const req = {
        ...payload,
        user: locationManager,
        context: { tenant: tenant.id },
      } as Parameters<typeof payload.update>[0]['req']

      await payload.update({
        collection: 'users',
        id: locationManager.id,
        data: { name: 'Site Manager Renamed' },
        req,
        overrideAccess: false,
      })

      const after = await payload.findByID({
        collection: 'users',
        id: locationManager.id,
        req,
        overrideAccess: false,
        depth: 0,
      })
      expect(after.name).toBe('Site Manager Renamed')
    },
    TEST_TIMEOUT,
  )

  it('checkRole recognises location-manager', () => {
    expect(
      checkRole(['location-manager'], {
        id: 1,
        name: 'x',
        email: 'x@y.z',
        role: ['location-manager'],
      } as User),
    ).toBe(true)
  })
})

/**
 * Phase 4 – Analytics API: access control and aggregation.
 * Tests GET /api/analytics with tenant scope and date range.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/analytics/route'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

function request(opts: {
  headers?: Record<string, string>
  url?: string
} = {}): NextRequest {
  const url = opts.url ?? 'http://localhost/api/analytics?dateFrom=2025-01-01&dateTo=2025-01-31'
  return new NextRequest(url, { headers: new Headers(opts.headers ?? {}) })
}

describe('Analytics API (Phase 4)', () => {
  let payload: Payload
  let adminUser: User
  let tenantAdminUser: User
  let regularUser: User
  let testTenantId: number
  let otherTenantId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Analytics Admin',
        email: `analytics-admin-${Date.now()}@test.com`,
        password: 'test',
        roles: ['super-admin'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Analytics Test Tenant',
        slug: `analytics-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    const otherTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Other Analytics Tenant',
        slug: `other-analytics-${Date.now()}`,
      },
      overrideAccess: true,
    })
    otherTenantId = otherTenant.id as number

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Analytics Tenant Admin',
        email: `analytics-ta-${Date.now()}@test.com`,
        password: 'test',
        roles: ['admin'],
        emailVerified: true,
        tenants: [{ tenant: testTenantId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    regularUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Analytics Regular User',
        email: `analytics-user-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'users',
          where: {
            id: { in: [adminUser.id, tenantAdminUser.id, regularUser.id] },
          },
        })
        await payload.delete({
          collection: 'tenants',
          where: { id: { in: [testTenantId, otherTenantId] } },
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  describe('access control', () => {
    it(
      'returns 401 when unauthenticated',
      async () => {
        const res = await GET(request())
        expect(res.status).toBe(401)
      },
      TEST_TIMEOUT,
    )

    it(
      'returns 403 when regular user (no admin role)',
      async () => {
        const res = await GET(
          request({
            headers: { 'x-test-user-id': String(regularUser.id) },
          }),
        )
        expect(res.status).toBe(403)
      },
      TEST_TIMEOUT,
    )

    it(
      'returns 403 when tenant-admin requests another tenant',
      async () => {
        const res = await GET(
          request({
            headers: {
              'x-test-user-id': String(tenantAdminUser.id),
              'x-tenant-id': String(otherTenantId),
            },
            url: `http://localhost/api/analytics?dateFrom=2025-01-01&dateTo=2025-01-31&tenantId=${otherTenantId}`,
          }),
        )
        expect(res.status).toBe(403)
      },
      TEST_TIMEOUT,
    )

    it(
      'returns 200 for admin with no tenantId (all tenants)',
      async () => {
        const res = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
          }),
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toHaveProperty('summary')
        expect(data.summary).toHaveProperty('totalBookings')
        expect(data.summary).toHaveProperty('uniqueCustomers')
        expect(typeof data.summary.totalBookings).toBe('number')
        expect(typeof data.summary.uniqueCustomers).toBe('number')
      },
      TEST_TIMEOUT,
    )

    it(
      'returns 200 for tenant-admin with their tenantId',
      async () => {
        const res = await GET(
          request({
            headers: {
              'x-test-user-id': String(tenantAdminUser.id),
              'x-tenant-id': String(testTenantId),
            },
            url: `http://localhost/api/analytics?dateFrom=2025-01-01&dateTo=2025-01-31&tenantId=${testTenantId}`,
          }),
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toHaveProperty('summary')
        expect(data.summary).toHaveProperty('totalBookings')
        expect(data.summary).toHaveProperty('uniqueCustomers')
      },
      TEST_TIMEOUT,
    )
  })

  describe('aggregation', () => {
    it(
      'returns summary with totalBookings and uniqueCustomers for date range',
      async () => {
        const res = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
            url: 'http://localhost/api/analytics?dateFrom=2025-01-01&dateTo=2025-01-31',
          }),
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.summary).toMatchObject({
          totalBookings: expect.any(Number),
          uniqueCustomers: expect.any(Number),
        })
        expect(data.summary.totalBookings).toBeGreaterThanOrEqual(0)
        expect(data.summary.uniqueCustomers).toBeGreaterThanOrEqual(0)
      },
      TEST_TIMEOUT,
    )

    it(
      'returns bookingsOverTime array with date and count',
      async () => {
        const res = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
            url: 'http://localhost/api/analytics?dateFrom=2025-01-01&dateTo=2025-01-31',
          }),
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toHaveProperty('bookingsOverTime')
        expect(Array.isArray(data.bookingsOverTime)).toBe(true)
        data.bookingsOverTime.forEach((row: { date: string; count: number }) => {
          expect(row).toHaveProperty('date')
          expect(row).toHaveProperty('count')
          expect(typeof row.count).toBe('number')
        })
      },
      TEST_TIMEOUT,
    )

    it(
      'returns topCustomers array with user id and booking count',
      async () => {
        const res = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
            url: 'http://localhost/api/analytics?dateFrom=2025-01-01&dateTo=2025-01-31',
          }),
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toHaveProperty('topCustomers')
        expect(Array.isArray(data.topCustomers)).toBe(true)
        data.topCustomers.forEach((row: { userId: number; count: number }) => {
          expect(row).toHaveProperty('userId')
          expect(row).toHaveProperty('count')
          expect(typeof row.count).toBe('number')
        })
      },
      TEST_TIMEOUT,
    )

    it(
      'bookingsOverTime includes zero-count days between booked days (Sat / Sun / Mon in range)',
      async () => {
        const satD = new Date(Date.UTC(2046, 0, 1))
        while (satD.getUTCDay() !== 6) {
          satD.setUTCDate(satD.getUTCDate() + 1)
        }
        const sunD = new Date(satD)
        sunD.setUTCDate(sunD.getUTCDate() + 1)
        const monD = new Date(sunD)
        monD.setUTCDate(monD.getUTCDate() + 1)
        const sat = satD.toISOString().slice(0, 10)
        const sun = sunD.toISOString().slice(0, 10)
        const mon = monD.toISOString().slice(0, 10)
        expect(sunD.getUTCDay()).toBe(0)
        expect(monD.getUTCDay()).toBe(1)

        const uniqueName = `Analytics Weekend Dense ${Date.now()}`
        const eventType = await payload.create({
          collection: 'event-types',
          data: {
            name: uniqueName,
            places: 10,
            description: 'dense bookingsOverTime series',
            tenant: testTenantId,
          },
          overrideAccess: true,
        })

        const mkTimeslot = async (ymd: string) => {
          const startTime = new Date(`${ymd}T12:00:00.000Z`)
          const endTime = new Date(startTime)
          endTime.setUTCHours(13)
          return payload.create({
            collection: 'timeslots',
            data: {
              date: startTime.toISOString(),
              startTime: startTime.toISOString(),
              endTime: endTime.toISOString(),
              eventType: eventType.id,
              tenant: testTenantId,
              active: true,
              lockOutTime: 0,
            },
            draft: false,
            overrideAccess: true,
          })
        }

        const slotSat = await mkTimeslot(sat)
        const slotSun = await mkTimeslot(sun)
        const slotMon = await mkTimeslot(mon)

        const bSat = await payload.create({
          collection: 'bookings',
          data: {
            tenant: testTenantId,
            user: regularUser.id,
            timeslot: slotSat.id,
            status: 'confirmed',
          },
          overrideAccess: true,
        })
        const bMon = await payload.create({
          collection: 'bookings',
          data: {
            tenant: testTenantId,
            user: regularUser.id,
            timeslot: slotMon.id,
            status: 'confirmed',
          },
          overrideAccess: true,
        })

        try {
          const url = `http://localhost/api/analytics?dateFrom=${sat}&dateTo=${mon}&tenantId=${testTenantId}`
          const res = await GET(
            request({
              headers: { 'x-test-user-id': String(adminUser.id) },
              url,
            }),
          )
          expect(res.status).toBe(200)
          const data = (await res.json()) as {
            bookingsOverTime: { date: string; count: number }[]
          }
          expect(data.bookingsOverTime).toHaveLength(3)
          const byDate = new Map(
            data.bookingsOverTime.map((r) => [r.date.slice(0, 10), r.count]),
          )
          expect(byDate.get(sat)).toBe(1)
          expect(byDate.get(sun)).toBe(0)
          expect(byDate.get(mon)).toBe(1)
        } finally {
          await payload
            .delete({
              collection: 'bookings',
              where: { id: { in: [bSat.id as number, bMon.id as number] } },
              overrideAccess: true,
            })
            .catch(() => {})
          await payload
            .delete({
              collection: 'timeslots',
              where: { id: { in: [slotSat.id as number, slotSun.id as number, slotMon.id as number] } },
              overrideAccess: true,
            })
            .catch(() => {})
          await payload
            .delete({
              collection: 'event-types',
              where: { id: { equals: eventType.id } },
              overrideAccess: true,
            })
            .catch(() => {})
        }
      },
      TEST_TIMEOUT,
    )

    it(
      'returns 400 when dateFrom or dateTo is missing',
      async () => {
        const resNoFrom = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
            url: 'http://localhost/api/analytics?dateTo=2025-01-31',
          }),
        )
        expect(resNoFrom.status).toBe(400)

        const resNoTo = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
            url: 'http://localhost/api/analytics?dateFrom=2025-01-01',
          }),
        )
        expect(resNoTo.status).toBe(400)
      },
      TEST_TIMEOUT,
    )

    it(
      'when comparePrevious=true returns summaryPrevious and bookingsOverTimePrevious with same shape',
      async () => {
        const res = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
            url:
              'http://localhost/api/analytics?dateFrom=2025-02-01&dateTo=2025-02-28&comparePrevious=true',
          }),
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toHaveProperty('summaryPrevious')
        expect(data.summaryPrevious).toMatchObject({
          totalBookings: expect.any(Number),
          uniqueCustomers: expect.any(Number),
        })
        expect(data).toHaveProperty('bookingsOverTimePrevious')
        expect(Array.isArray(data.bookingsOverTimePrevious)).toBe(true)
        data.bookingsOverTimePrevious.forEach(
          (row: { date: string; count: number }) => {
            expect(row).toHaveProperty('date')
            expect(row).toHaveProperty('count')
            expect(typeof row.count).toBe('number')
          },
        )
      },
      TEST_TIMEOUT,
    )

    it(
      'when comparePrevious=false does not include summaryPrevious',
      async () => {
        const res = await GET(
          request({
            headers: { 'x-test-user-id': String(adminUser.id) },
            url: 'http://localhost/api/analytics?dateFrom=2025-01-01&dateTo=2025-01-31',
          }),
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).not.toHaveProperty('summaryPrevious')
        expect(data).not.toHaveProperty('bookingsOverTimePrevious')
      },
      TEST_TIMEOUT,
    )

    /**
     * Proves the Postgres-safe path (startTime query + calendar date filter + booking chunks):
     * without this, tests only assert shape and >= 0 counts.
     */
    it(
      'increments totalBookings by 1 after adding a confirmed booking in a far-future calendar range',
      async () => {
        const from = '2045-03-01'
        const to = '2045-03-31'
        const baseUrl = `http://localhost/api/analytics?dateFrom=${from}&dateTo=${to}`
        const adminHeaders = { 'x-test-user-id': String(adminUser.id) }

        const beforeRes = await GET(request({ headers: adminHeaders, url: baseUrl }))
        expect(beforeRes.status).toBe(200)
        const beforeJson = (await beforeRes.json()) as { summary: { totalBookings: number } }
        const beforeTotal = beforeJson.summary.totalBookings

        const uniqueName = `Analytics ET ${Date.now()}`
        const eventType = await payload.create({
          collection: 'event-types',
          data: {
            name: uniqueName,
            places: 10,
            description: 'analytics int test',
            tenant: testTenantId,
          },
          overrideAccess: true,
        })

        const startTime = new Date('2045-03-15T12:00:00.000Z')
        const endTime = new Date('2045-03-15T13:00:00.000Z')
        const timeslot = await payload.create({
          collection: 'timeslots',
          data: {
            date: startTime.toISOString(),
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            eventType: eventType.id,
            tenant: testTenantId,
            active: true,
            lockOutTime: 0,
          },
          draft: false,
          overrideAccess: true,
        })

        const booking = await payload.create({
          collection: 'bookings',
          data: {
            tenant: testTenantId,
            user: regularUser.id,
            timeslot: timeslot.id,
            status: 'confirmed',
          },
          overrideAccess: true,
        })

        try {
          const afterRes = await GET(request({ headers: adminHeaders, url: baseUrl }))
          expect(afterRes.status).toBe(200)
          const afterJson = (await afterRes.json()) as {
            summary: { totalBookings: number; uniqueCustomers: number }
            bookingsOverTime: { date: string; count: number }[]
            topCustomers: { userId: number; count: number }[]
          }
          expect(afterJson.summary.totalBookings - beforeTotal).toBe(1)
          expect(afterJson.summary.uniqueCustomers).toBeGreaterThanOrEqual(1)

          const march15 = afterJson.bookingsOverTime.find((r) => r.date.startsWith('2045-03-15'))
          expect(march15?.count).toBeGreaterThanOrEqual(1)

          const top = afterJson.topCustomers.find((r) => r.userId === regularUser.id)
          expect(top?.count).toBeGreaterThanOrEqual(1)
        } finally {
          await payload
            .delete({
              collection: 'bookings',
              where: { id: { equals: booking.id } },
              overrideAccess: true,
            })
            .catch(() => {})
          await payload
            .delete({
              collection: 'timeslots',
              where: { id: { equals: timeslot.id } },
              overrideAccess: true,
            })
            .catch(() => {})
          await payload
            .delete({
              collection: 'event-types',
              where: { id: { equals: eventType.id } },
              overrideAccess: true,
            })
            .catch(() => {})
        }
      },
      TEST_TIMEOUT,
    )
  })
})

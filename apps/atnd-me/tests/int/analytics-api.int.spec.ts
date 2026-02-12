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
        roles: ['admin'],
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
        roles: ['tenant-admin'],
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
  })
})

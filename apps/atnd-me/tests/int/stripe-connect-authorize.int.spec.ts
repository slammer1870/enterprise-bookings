/**
 * Step 2.3 – OAuth initiation route /api/stripe/connect/authorize
 * Request handler tests; no Stripe network call.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/stripe/connect/authorize/route'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Stripe Connect authorize route (step 2.3)', () => {
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
        name: 'Admin Authorize',
        email: `admin-authorize-${Date.now()}@test.com`,
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
        name: 'Authorize Test Tenant',
        slug: `authorize-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    const otherTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Other Tenant',
        slug: `other-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    otherTenantId = otherTenant.id as number

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin Authorize',
        email: `tenant-admin-authorize-${Date.now()}@test.com`,
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
        name: 'Regular Authorize',
        email: `regular-authorize-${Date.now()}@test.com`,
        password: 'test',
        roles: ['user'],
        emailVerified: true,
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    // Stripe Connect env required for route to build URL (no actual Stripe call)
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    process.env.STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_test_placeholder'
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_placeholder'
  })

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'users',
          where: {
            id: {
              in: [adminUser.id, tenantAdminUser.id, regularUser.id],
            },
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

  function request(opts: {
    headers?: Record<string, string>
    url?: string
  } = {}): NextRequest {
    const url = opts.url ?? 'http://localhost/api/stripe/connect/authorize'
    const h = new Headers(opts.headers ?? {})
    return new NextRequest(url, { headers: h })
  }

  it(
    'rejects if no authenticated tenant-admin/admin',
    async () => {
      const res = await GET(request())
      expect(res.status).toBe(401)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects if tenant context is missing (admin with no tenant)',
    async () => {
      const res = await GET(
        request({
          headers: {
            'x-test-user-id': String(adminUser.id),
          },
        }),
      )
      expect(res.status).toBe(400)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects if tenant-admin requests a tenant they do not belong to',
    async () => {
      const res = await GET(
        request({
          headers: {
            'x-test-user-id': String(tenantAdminUser.id),
            'x-tenant-id': String(otherTenantId),
          },
        }),
      )
      expect(res.status).toBe(403)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects regular user even with tenant context',
    async () => {
      const res = await GET(
        request({
          headers: {
            'x-test-user-id': String(regularUser.id),
            'x-tenant-id': String(testTenantId),
          },
        }),
      )
      expect(res.status).toBe(401)
    },
    TEST_TIMEOUT,
  )

  it(
    'builds Stripe Connect URL with client_id, redirect_uri, state when admin + tenant',
    async () => {
      const res = await GET(
        request({
          headers: {
            'x-test-user-id': String(adminUser.id),
            'x-tenant-id': String(testTenantId),
          },
          url: 'http://localhost:3000/api/stripe/connect/authorize',
        }),
      )
      expect(res.status).toBe(302)
      const location = res.headers.get('location')
      expect(location).toBeDefined()
      expect(location).toContain('connect.stripe.com/oauth/authorize')
      expect(location).toMatch(/client_id=/)
      expect(location).toMatch(/redirect_uri=/)
      expect(location).toMatch(/response_type=code/)
      expect(location).toMatch(/state=/)
      expect(location).toMatch(/scope=read_write/)
    },
    TEST_TIMEOUT,
  )

  it(
    'builds Stripe Connect URL when tenant-admin requests their tenant',
    async () => {
      const res = await GET(
        request({
          headers: {
            'x-test-user-id': String(tenantAdminUser.id),
            'x-tenant-id': String(testTenantId),
          },
          url: 'http://localhost:3000/api/stripe/connect/authorize',
        }),
      )
      expect(res.status).toBe(302)
      const location = res.headers.get('location')
      expect(location).toContain('connect.stripe.com/oauth/authorize')
      expect(location).toMatch(/client_id=ca_test_placeholder|client_id=/)
      // redirect_uri may be URL-encoded (e.g. %2F for /)
      expect(location).toMatch(/redirect_uri=[^&]*callback/)
      expect(location).toMatch(/state=/)
    },
    TEST_TIMEOUT,
  )
})

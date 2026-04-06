/**
 * Phase 4.5 – GET /stripe/plans: tenant-aware proxy returns recurring products from Connect; auth required.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

const mockPlans = vi.hoisted(() => [
  { id: 'prod_plan_1', default_price: { type: 'recurring', id: 'price_1' } },
  { id: 'prod_plan_2', default_price: { type: 'recurring', id: 'price_2' } },
])

vi.mock('@repo/shared-utils', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    stripe: {
      products: {
        list: vi.fn().mockReturnValue({
          autoPagingToArray: vi.fn().mockResolvedValue(mockPlans),
        }),
      },
    },
  }
})

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)

describe('Stripe plans proxy (Phase 4.5)', () => {
  let payload: Payload
  let adminUser: User
  let tenantWithConnectId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin Plans Proxy',
        email: `admin-proxy-${Date.now()}@test.com`,
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
        name: 'Plans Proxy Tenant',
        slug: `plans-proxy-${Date.now()}`,
        stripeConnectAccountId: `acct_plans_proxy_${runId}`,
        stripeConnectOnboardingStatus: 'active',
      },
      overrideAccess: true,
    })
    tenantWithConnectId = tenant.id as number
  }, HOOK_TIMEOUT)

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({ collection: 'users', where: { id: { equals: adminUser.id } } })
        await payload.delete({ collection: 'tenants', where: { id: { equals: tenantWithConnectId } } })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'GET plans with admin and tenant context returns recurring products from Connect',
    async () => {
      const endpoints = (await config).endpoints ?? []
      const plansEndpoint = endpoints.find(
        (e) => typeof e === 'object' && e !== null && 'path' in e && e.path === '/stripe/plans' && e.method === 'get',
      )
      expect(plansEndpoint).toBeDefined()
      const handler = (plansEndpoint as { handler: (req: unknown) => Promise<Response> }).handler
      const mockReq = {
        user: adminUser,
        payload,
        context: { tenant: tenantWithConnectId },
      }
      const res = await handler(mockReq)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data).toHaveLength(2)
      expect(body.data[0].default_price?.type).toBe('recurring')
    },
    TEST_TIMEOUT,
  )

  it(
    'GET plans without auth returns 401',
    async () => {
      const endpoints = (await config).endpoints ?? []
      const plansEndpoint = endpoints.find(
        (e) => typeof e === 'object' && e !== null && 'path' in e && e.path === '/stripe/plans' && e.method === 'get',
      )
      const handler = (plansEndpoint as { handler: (req: unknown) => Promise<Response> }).handler
      const mockReq = { user: null, payload }
      const res = await handler(mockReq)
      expect(res.status).toBe(401)
    },
    TEST_TIMEOUT,
  )
})

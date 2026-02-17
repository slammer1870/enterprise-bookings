/**
 * Phase 4.5 – GET /stripe/class-pass-products: tenant-aware proxy returns one-time products from Connect.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

const mockOneTimeProducts = [
  { id: 'prod_cp_1', default_price: { type: 'one_time', id: 'price_cp_1' } },
]

vi.mock('@repo/shared-utils', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    stripe: {
      products: {
        list: vi.fn().mockReturnValue({
          autoPagingToArray: vi.fn().mockResolvedValue(mockOneTimeProducts),
        }),
      },
    },
  }
})

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Stripe class-pass-products proxy (Phase 4.5)', () => {
  let payload: Payload
  let adminUser: User
  let tenantWithConnectId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin CP Products Proxy',
        email: `admin-cpp-${Date.now()}@test.com`,
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
        name: 'CP Products Proxy Tenant',
        slug: `cpp-tenant-${Date.now()}`,
        stripeConnectAccountId: 'acct_cpp',
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
    'GET class-pass-products with admin and tenant context returns one-time products',
    async () => {
      const endpoints = (await config).endpoints ?? []
      const endpoint = endpoints.find(
        (e) =>
          typeof e === 'object' &&
          e !== null &&
          'path' in e &&
          e.path === '/stripe/class-pass-products' &&
          e.method === 'get',
      )
      expect(endpoint).toBeDefined()
      const handler = (endpoint as { handler: (req: unknown) => Promise<Response> }).handler
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
      expect(body.data[0].default_price?.type).toBe('one_time')
    },
    TEST_TIMEOUT,
  )
})

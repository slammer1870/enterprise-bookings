/**
 * Step 2.4 – OAuth callback route /api/stripe/connect/callback
 * Verifies state; mocks Stripe token exchange.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('@/lib/stripe-connect/callbackExchange', () => ({
  exchangeCodeForStripeConnectAccount: vi.fn(),
}))
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/stripe/connect/callback/route'
import { buildConnectState } from '@/lib/stripe-connect/authorize'
import * as callbackExchange from '@/lib/stripe-connect/callbackExchange'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

describe('Stripe Connect callback route (step 2.4)', () => {
  let payload: Payload
  let adminUser: User
  let testTenantId: number
  let failTenantId: number // used only for "on failed exchange" so it has no account id

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    adminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Admin Callback',
        email: `admin-callback-${Date.now()}@test.com`,
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
        name: 'Callback Test Tenant',
        slug: `callback-tenant-${Date.now()}`,
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    const failTenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Callback Fail Tenant',
        slug: `callback-fail-${Date.now()}`,
      },
      overrideAccess: true,
    })
    failTenantId = failTenant.id as number
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
    process.env.STRIPE_CONNECT_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID || 'ca_test_placeholder'
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_placeholder'
    vi.mocked(callbackExchange.exchangeCodeForStripeConnectAccount).mockReset()
  })

  afterAll(async () => {
    if (payload) {
      try {
        await payload.delete({
          collection: 'users',
          where: { id: { equals: adminUser.id } },
        })
      await payload.delete({
        collection: 'tenants',
        where: { id: { in: [testTenantId, failTenantId] } },
      })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  function request(params: {
    code?: string
    state?: string
    error?: string
    headers?: Record<string, string>
  }) {
    const search = new URLSearchParams()
    if (params.code) search.set('code', params.code)
    if (params.state) search.set('state', params.state)
    if (params.error) search.set('error', params.error)
    const url = `http://localhost:3000/api/stripe/connect/callback?${search.toString()}`
    return new NextRequest(url, { headers: params.headers ?? {} })
  }

  it(
    'rejects when state is missing',
    async () => {
      const res = await GET(request({ code: 'auth_code_123' }))
      expect(res.status).toBe(400)
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects when state signature is invalid',
    async () => {
      const res = await GET(request({ code: 'auth_code_123', state: 'invalid.tampered' }))
      expect(res.status).toBe(400)
      expect(callbackExchange.exchangeCodeForStripeConnectAccount).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects when state is expired',
    async () => {
      const expiredState = buildConnectState(testTenantId, adminUser.id as number, Date.now() - 60_000)
      const res = await GET(request({ code: 'auth_code_123', state: expiredState }))
      expect(res.status).toBe(400)
      expect(callbackExchange.exchangeCodeForStripeConnectAccount).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'rejects when current user does not match state.userId (step 2.9 CSRF)',
    async () => {
      const validState = buildConnectState(testTenantId, adminUser.id as number)
      const res = await GET(
        request({
          code: 'auth_code_123',
          state: validState,
          headers: { 'x-test-user-id': '999999' },
        }),
      )
      expect(res.status).toBe(302)
      const location = res.headers.get('location') ?? ''
      expect(location).toContain('stripe_connect=error')
      expect(location).toMatch(/user.?mismatch|message=/i)
      expect(callbackExchange.exchangeCodeForStripeConnectAccount).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'on successful exchange: updates tenant stripeConnectAccountId and sets stripeConnectOnboardingStatus to pending',
    async () => {
      const callbackHost = 'callback-tenant.localhost:3000'
      vi.mocked(callbackExchange.exchangeCodeForStripeConnectAccount).mockResolvedValue({
        stripe_user_id: 'acct_cb_test_123',
        stripe_account_id: 'acct_cb_test_123',
      })
      const validState = buildConnectState(testTenantId, adminUser.id as number)
      const res = await GET(
        request({
          code: 'auth_code_ok',
          state: validState,
          headers: {
            'x-test-user-id': String(adminUser.id),
            host: callbackHost,
          },
        }),
      )

      expect(res.status).toBe(302)
      const location = res.headers.get('location') ?? ''
      expect(location).toBe(`http://${callbackHost}/admin?stripe_connect=success`)
      expect(callbackExchange.exchangeCodeForStripeConnectAccount).toHaveBeenCalledWith(
        'auth_code_ok',
        `http://${callbackHost}/api/stripe/connect/callback`,
      )

      const updated = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        overrideAccess: true,
      })
      expect(updated.stripeConnectAccountId).toBe('acct_cb_test_123')
      expect(updated.stripeConnectOnboardingStatus).toBe('pending')
    },
    TEST_TIMEOUT,
  )

  it(
    'on failed exchange: does not update tenant account/status, stores error in stripeConnectLastError',
    async () => {
      vi.mocked(callbackExchange.exchangeCodeForStripeConnectAccount).mockRejectedValue(
        new Error('invalid_grant: code already used'),
      )
      const validState = buildConnectState(failTenantId, adminUser.id as number)
      const res = await GET(
        request({
          code: 'used_code',
          state: validState,
          headers: { 'x-test-user-id': String(adminUser.id) },
        }),
      )

      expect(res.status).toBe(302)
      const location = res.headers.get('location') ?? ''
      expect(location).toMatch(/error|fail/i)

      const updated = await payload.findByID({
        collection: 'tenants',
        id: failTenantId,
        overrideAccess: true,
      })
      expect(updated.stripeConnectAccountId == null || updated.stripeConnectAccountId === '').toBe(true)
      expect(updated.stripeConnectLastError).toBeDefined()
      expect(String(updated.stripeConnectLastError)).toMatch(/invalid_grant|already used|error/i)
    },
    TEST_TIMEOUT,
  )
})

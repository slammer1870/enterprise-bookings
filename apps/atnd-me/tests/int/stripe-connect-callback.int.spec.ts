/**
 * Step 2.4 – OAuth callback route /api/stripe/connect/callback
 * Verifies state; mocks Stripe token exchange.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('@/lib/stripe-connect/callbackExchange', () => ({
  exchangeCodeForStripeConnectAccount: vi.fn(),
}))
vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: vi.fn(),
  getStripeConnectEnv: vi.fn(() => ({
    platformSecretKey: 'sk_test_placeholder',
    connectClientId: 'ca_test_placeholder',
    webhookSecret: 'whsec_placeholder',
  })),
}))
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/stripe/connect/callback/route'
import { buildConnectState } from '@/lib/stripe-connect/authorize'
import * as callbackExchange from '@/lib/stripe-connect/callbackExchange'
import { getPlatformStripe } from '@/lib/stripe/platform'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const callbackAccountId = `acct_cb_test_123_${runId}`

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
        role: ['super-admin'],
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
    vi.mocked(getPlatformStripe).mockReset()
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
    'redirects Stripe errors back to the tenant return URL from signed state',
    async () => {
      const returnTo = 'http://tenant-callback.localhost:3000/admin'
      const validState = buildConnectState(testTenantId, adminUser.id as number, undefined, returnTo)
      const res = await GET(
        request({
          state: validState,
          error: 'access_denied',
        }),
      )
      expect(res.status).toBe(302)
      const location = res.headers.get('location') ?? ''
      expect(location).toBe(`${returnTo}?stripe_connect=error&message=access_denied`)
      expect(callbackExchange.exchangeCodeForStripeConnectAccount).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'on successful exchange: updates tenant stripeConnectAccountId and sets stripeConnectOnboardingStatus to active when the account is fully enabled',
    async () => {
      const callbackHost = 'platform.localhost:3000'
      const returnTo = 'http://tenant-success.localhost:3000/admin'
      vi.mocked(callbackExchange.exchangeCodeForStripeConnectAccount).mockResolvedValue({
        stripe_user_id: callbackAccountId,
        stripe_account_id: callbackAccountId,
      })
      vi.mocked(getPlatformStripe).mockReturnValue({
        accounts: {
          retrieve: vi.fn().mockResolvedValue({
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            requirements: {
              disabled_reason: null,
              currently_due: [],
              eventually_due: [],
              past_due: [],
              pending_verification: [],
            },
          }),
        },
      } as never)
      const validState = buildConnectState(testTenantId, adminUser.id as number, undefined, returnTo)
      const res = await GET(
        request({
          code: 'auth_code_ok',
          state: validState,
          headers: {
            host: callbackHost,
          },
        }),
      )

      expect(res.status).toBe(302)
      const location = res.headers.get('location') ?? ''
      expect(location).toBe(`${returnTo}?stripe_connect=success`)
      expect(callbackExchange.exchangeCodeForStripeConnectAccount).toHaveBeenCalledWith(
        'auth_code_ok',
        'http://localhost:3000/api/stripe/connect/callback',
      )

      const updated = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        overrideAccess: true,
      })
      expect(updated.stripeConnectAccountId).toBe(callbackAccountId)
      expect(updated.stripeConnectOnboardingStatus).toBe('active')
    },
    TEST_TIMEOUT,
  )

  it(
    'on successful exchange: keeps tenant pending when Stripe account still has outstanding requirements',
    async () => {
      const returnTo = 'http://tenant-pending.localhost:3000/admin'
      vi.mocked(callbackExchange.exchangeCodeForStripeConnectAccount).mockResolvedValue({
        stripe_user_id: callbackAccountId,
        stripe_account_id: callbackAccountId,
      })
      vi.mocked(getPlatformStripe).mockReturnValue({
        accounts: {
          retrieve: vi.fn().mockResolvedValue({
            charges_enabled: false,
            payouts_enabled: false,
            details_submitted: false,
            requirements: {
              disabled_reason: 'requirements.past_due',
              currently_due: ['business_profile.url'],
              eventually_due: [],
              past_due: ['external_account'],
              pending_verification: [],
            },
          }),
        },
      } as never)
      const validState = buildConnectState(testTenantId, adminUser.id as number, undefined, returnTo)

      const res = await GET(
        request({
          code: 'auth_code_pending',
          state: validState,
        }),
      )

      expect(res.status).toBe(302)
      const updated = await payload.findByID({
        collection: 'tenants',
        id: testTenantId,
        overrideAccess: true,
      })
      expect(updated.stripeConnectAccountId).toBe(callbackAccountId)
      expect(updated.stripeConnectOnboardingStatus).toBe('pending')
    },
    TEST_TIMEOUT,
  )

  it(
    'on failed exchange: does not update tenant account/status, stores error in stripeConnectLastError',
    async () => {
      const returnTo = 'http://tenant-fail.localhost:3000/admin'
      vi.mocked(callbackExchange.exchangeCodeForStripeConnectAccount).mockRejectedValue(
        new Error('invalid_grant: code already used'),
      )
      const validState = buildConnectState(failTenantId, adminUser.id as number, undefined, returnTo)
      const res = await GET(
        request({
          code: 'used_code',
          state: validState,
        }),
      )

      expect(res.status).toBe(302)
      const location = res.headers.get('location') ?? ''
      expect(location).toBe(`${returnTo}?stripe_connect=error&message=invalid_grant%3A+code+already+used`)

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

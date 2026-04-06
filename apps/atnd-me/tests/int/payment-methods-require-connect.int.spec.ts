/**
 * Step 2.6.1 – Int: Payment methods require Stripe Connect (server enforcement).
 * - Setting any payment method (allowedDropIn, allowedPlans, allowedClassPasses) while tenant not connected is rejected.
 * - When tenant is connected, saving with a payment method succeeds.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { User } from '@repo/shared-types'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000
const runId = Math.random().toString(36).slice(2, 10)
const stripeConnectAccountId = `acct_test_payments_${runId}`

describe('Payment methods require Stripe Connect (step 2.6.1)', () => {
  let payload: Payload
  let tenantAdminUser: User
  let testTenantId: number
  let classOptionId: number
  let dropInId: number

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Payments Require Connect Tenant',
        slug: `payments-require-connect-${Date.now()}`,
        stripeConnectOnboardingStatus: 'not_connected',
      },
      overrideAccess: true,
    })
    testTenantId = tenant.id as number

    tenantAdminUser = (await payload.create({
      collection: 'users',
      data: {
        name: 'Tenant Admin Payments',
        email: `tenant-admin-payments-${Date.now()}@test.com`,
        password: 'test',
        roles: ['tenant-admin'],
        emailVerified: true,
        tenants: [{ tenant: testTenantId }],
      },
      draft: false,
      overrideAccess: true,
    } as Parameters<typeof payload.create>[0])) as User

    const dropIn = await payload.create({
      collection: 'drop-ins',
      data: {
        name: `Test Drop-in ${Date.now()}`,
        isActive: true,
        price: 1000,
        adjustable: true,
        paymentMethods: ['card'],
        tenant: testTenantId,
      },
      overrideAccess: true,
    })
    dropInId = dropIn.id as number

    const co = await payload.create({
      collection: 'class-options',
      data: {
        name: `Payments Test Class ${Date.now()}`,
        places: 5,
        description: 'Test',
        tenant: testTenantId,
      },
      overrideAccess: true,
    })
    classOptionId = co.id as number
  }, HOOK_TIMEOUT)

  it(
    'rejects setting payment methods when tenant is not connected',
    async () => {
      await expect(
        payload.update({
          collection: 'class-options',
          id: classOptionId,
          data: {
            paymentMethods: { allowedDropIn: dropInId },
          },
          overrideAccess: false,
          user: tenantAdminUser,
        } as Parameters<typeof payload.update>[0]),
      ).rejects.toThrow(/connect|stripe|payment/i)
    },
    TEST_TIMEOUT,
  )

  it(
    'allows setting payment methods when tenant is connected',
    async () => {
      await payload.update({
        collection: 'tenants',
        id: testTenantId,
        data: {
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId,
        },
        overrideAccess: true,
      })

      const updated = await payload.update({
        collection: 'class-options',
        id: classOptionId,
        data: {
          paymentMethods: { allowedDropIn: dropInId },
        },
        depth: 0,
        overrideAccess: false,
        user: tenantAdminUser,
      } as Parameters<typeof payload.update>[0])

      expect((updated as any).paymentMethods).toBeDefined()
      expect((updated as { places?: number }).places).toBe(5)
      const pm = (updated as any).paymentMethods as { allowedDropIn?: number | { id: number } | null }
      const allowedDropInId =
        pm?.allowedDropIn == null
          ? null
          : typeof pm.allowedDropIn === 'object' && pm.allowedDropIn !== null && 'id' in pm.allowedDropIn
            ? pm.allowedDropIn.id
            : pm.allowedDropIn
      expect(allowedDropInId).toBe(dropInId)
    },
    TEST_TIMEOUT,
  )
})

/**
 * Step 2.7 – Payment routing: PaymentIntent on behalf of tenant (destination charges).
 * - When tenant is connected, payment creation uses on_behalf_of + transfer_data.destination.
 * - amount === classPrice + bookingFee, application_fee_amount === bookingFee.
 * - When tenant is not connected, payment creation is blocked.
 * - Stripe SDK is mocked (no real API calls).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

const mockPaymentIntentsCreate = vi.fn()
vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: vi.fn(() => ({
    paymentIntents: { create: mockPaymentIntentsCreate },
  })),
}))

import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import type { TenantStripeLike } from '@/lib/stripe-connect/tenantStripe'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'
import { TenantNotConnectedError } from '@/lib/stripe-connect/tenantStripe'
import { calculateQuantityDiscount } from '@repo/shared-utils'

const HOOK_TIMEOUT = 300000
const TEST_TIMEOUT = 60000

type TenantDoc = TenantStripeLike & { id: number }

describe('Payments Connect routing (step 2.7)', () => {
  let payload: Payload
  let connectedTenant: TenantDoc
  let disconnectedTenant: TenantDoc

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    const connected = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Connected Routing Tenant',
        slug: `connected-routing-${Date.now()}`,
        stripeConnectOnboardingStatus: 'active',
        stripeConnectAccountId: 'acct_connected_routing',
      },
      overrideAccess: true,
    })
    connectedTenant = connected as TenantDoc

    const disconnected = await payload.create({
      collection: 'tenants',
      data: {
        name: 'Disconnected Routing Tenant',
        slug: `disconnected-routing-${Date.now()}`,
        stripeConnectOnboardingStatus: 'not_connected',
      },
      overrideAccess: true,
    })
    disconnectedTenant = disconnected as TenantDoc

    // Ensure platform-fees global exists with a deterministic drop-in percent for this suite.
    await payload.updateGlobal({
      slug: 'platform-fees',
      data: {
        defaults: {
          dropInPercent: 10,
          classPassPercent: 3,
          subscriptionPercent: 4,
        },
        overrides: [],
      },
      depth: 0,
      overrideAccess: true,
    } as Parameters<typeof payload.updateGlobal>[0])
  }, HOOK_TIMEOUT)

  beforeEach(() => {
    mockPaymentIntentsCreate.mockReset()
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_xxx',
    })
    process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'
  })

  afterAll(async () => {
    if (payload?.db) {
      try {
        await payload.delete({
          collection: 'tenants',
          where: {
            id: { in: [connectedTenant.id, disconnectedTenant.id] as number[] },
          },
          overrideAccess: true,
        })
      } catch {
        // ignore
      }
      await payload.db?.destroy?.()
    }
  })

  it(
    'when tenant is connected, creates PaymentIntent with on_behalf_of and transfer_data.destination',
    async () => {
      await createTenantPaymentIntent({
        tenant: connectedTenant,
        classPriceAmount: 1000,
        currency: 'eur',
        bookingFeeAmount: 50,
        metadata: { tenantId: String(connectedTenant.id), bookingId: 'bk_1' },
      })

      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1)
      const call = mockPaymentIntentsCreate.mock.calls[0]?.[0]
      expect(call?.on_behalf_of).toBe('acct_connected_routing')
      expect(call?.transfer_data?.destination).toBe('acct_connected_routing')
    },
    TEST_TIMEOUT,
  )

  it(
    'when tenant is connected, amount is classPrice + bookingFee and application_fee_amount is bookingFee',
    async () => {
      await createTenantPaymentIntent({
        tenant: connectedTenant,
        classPriceAmount: 2000,
        currency: 'eur',
        bookingFeeAmount: 100,
        metadata: { tenantId: String(connectedTenant.id), bookingId: 'bk_2' },
      })

      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1)
      const call = mockPaymentIntentsCreate.mock.calls[0]?.[0]
      expect(call?.amount).toBe(2100)
      expect(call?.application_fee_amount).toBe(100)
      expect(call?.currency).toBe('eur')
    },
    TEST_TIMEOUT,
  )

  it(
    'when tenant is connected, metadata includes tenantId, bookingId, classPriceAmount, bookingFeeAmount',
    async () => {
      await createTenantPaymentIntent({
        tenant: connectedTenant,
        classPriceAmount: 500,
        currency: 'gbp',
        bookingFeeAmount: 25,
        metadata: { tenantId: String(connectedTenant.id), bookingId: 'bk_meta' },
      })

      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1)
      const call = mockPaymentIntentsCreate.mock.calls[0]?.[0]
      expect(call?.metadata).toMatchObject({
        tenantId: String(connectedTenant.id),
        bookingId: 'bk_meta',
        classPriceAmount: '500',
        bookingFeeAmount: '25',
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'when productType+payload are passed, bookingFeeAmount is computed from PlatformFees (works with discounted totals)',
    async () => {
      // €10.00 x2 with 10% discount => €18.00 => 1800 cents
      const discount = calculateQuantityDiscount(
        10,
        2,
        [{ minQuantity: 2, discountPercent: 10, type: 'normal' }],
      )
      expect(discount.totalAmount).toBe(18)
      const classPriceAmountCents = Math.round(discount.totalAmount * 100)
      expect(classPriceAmountCents).toBe(1800)

      await createTenantPaymentIntent({
        tenant: connectedTenant,
        classPriceAmount: classPriceAmountCents,
        currency: 'eur',
        productType: 'drop-in',
        payload,
        metadata: { tenantId: String(connectedTenant.id), bookingId: 'bk_discount_fee' },
      })

      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1)
      const call = mockPaymentIntentsCreate.mock.calls[0]?.[0]
      // PlatformFees defaults: dropInPercent=10 => fee=180 cents, total=1980 cents
      expect(call?.application_fee_amount).toBe(180)
      expect(call?.amount).toBe(1980)
      expect(call?.metadata).toMatchObject({
        classPriceAmount: '1800',
        bookingFeeAmount: '180',
      })
    },
    TEST_TIMEOUT,
  )

  it(
    'when tenant is not connected, payment creation is blocked with TenantNotConnectedError',
    async () => {
      await expect(
        createTenantPaymentIntent({
          tenant: disconnectedTenant,
          classPriceAmount: 1000,
          currency: 'eur',
          bookingFeeAmount: 50,
          metadata: { tenantId: String(disconnectedTenant.id), bookingId: 'bk_x' },
        }),
      ).rejects.toThrow(TenantNotConnectedError)

      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled()
    },
    TEST_TIMEOUT,
  )

  it(
    'uses the passed tenant account for destination (tenant A vs tenant B)',
    async () => {
      const otherConnected = await payload.create({
        collection: 'tenants',
        data: {
          name: 'Other Connected',
          slug: `other-connected-${Date.now()}`,
          stripeConnectOnboardingStatus: 'active',
          stripeConnectAccountId: 'acct_other_xyz',
        },
        overrideAccess: true,
      })
      const other = otherConnected as TenantDoc

      await createTenantPaymentIntent({
        tenant: other,
        classPriceAmount: 500,
        currency: 'eur',
        bookingFeeAmount: 20,
        metadata: { tenantId: String(other.id), bookingId: 'bk_other' },
      })

      expect(mockPaymentIntentsCreate).toHaveBeenCalledTimes(1)
      const call = mockPaymentIntentsCreate.mock.calls[0]?.[0]
      expect(call?.transfer_data?.destination).toBe('acct_other_xyz')
      expect(call?.on_behalf_of).toBe('acct_other_xyz')
      expect(call?.metadata?.tenantId).toBe(String(other.id))

      await payload.delete({
        collection: 'tenants',
        id: other.id,
        overrideAccess: true,
      })
    },
    TEST_TIMEOUT,
  )
})

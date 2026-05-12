import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APIError } from 'payload'
import {
  planBeforeValidateStripeConnect,
  classPassTypeBeforeValidateStripeConnect,
} from '@/hooks/requireTenantStripeConnectForPricedProducts'

function makeReq(overrides: {
  tenant?: { stripeConnectAccountId?: string | null; stripeConnectOnboardingStatus?: string | null }
  context?: Record<string, unknown>
} = {}) {
  const tenant = overrides.tenant ?? {
    stripeConnectAccountId: 'acct_active',
    stripeConnectOnboardingStatus: 'active',
  }
  return {
    context: overrides.context ?? {},
    payload: {
      findByID: vi.fn().mockResolvedValue(tenant),
    },
  } as const
}

describe('requireTenantStripeConnectForPricedProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('planBeforeValidateStripeConnect', () => {
    it('skips when skipStripeSync is on request context', async () => {
      const data = { tenant: 1, priceInformation: { price: 10, interval: 'month', intervalCount: 1 } }
      const req = makeReq({ context: { skipStripeSync: true } })
      await expect(
        planBeforeValidateStripeConnect({
          data,
          operation: 'create',
          originalDoc: undefined,
          req: req as never,
        }),
      ).resolves.toEqual(data)
      expect(req.payload.findByID).not.toHaveBeenCalled()
    })

    it('skips when skipSync is true on document', async () => {
      const data = {
        tenant: 1,
        priceInformation: { price: 10, interval: 'month', intervalCount: 1 },
        skipSync: true,
      }
      const req = makeReq({
        tenant: { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' },
      })
      await expect(
        planBeforeValidateStripeConnect({
          data,
          operation: 'create',
          originalDoc: undefined,
          req: { ...req, payload: { findByID: vi.fn() } } as never,
        }),
      ).resolves.toEqual(data)
    })

    it('throws when creating a priced plan for a tenant without active Connect', async () => {
      const req = makeReq({
        tenant: { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' },
      })
      await expect(
        planBeforeValidateStripeConnect({
          data: { tenant: 9, priceInformation: { price: 12, interval: 'month', intervalCount: 1 } },
          operation: 'create',
          originalDoc: undefined,
          req: req as never,
        }),
      ).rejects.toThrow(APIError)
      await expect(
        planBeforeValidateStripeConnect({
          data: { tenant: 9, priceInformation: { price: 12, interval: 'month', intervalCount: 1 } },
          operation: 'create',
          originalDoc: undefined,
          req: req as never,
        }),
      ).rejects.toThrow(/Stripe Connect/i)
    })

    it('allows create when price is absent', async () => {
      const req = makeReq({
        tenant: { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' },
      })
      await expect(
        planBeforeValidateStripeConnect({
          data: { tenant: 9, name: 'Draft' },
          operation: 'create',
          originalDoc: undefined,
          req: req as never,
        }),
      ).resolves.toBeDefined()
      expect(req.payload.findByID).not.toHaveBeenCalled()
    })

    it('allows update that only changes name (no priceInformation in payload)', async () => {
      const req = makeReq({
        tenant: { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' },
      })
      await expect(
        planBeforeValidateStripeConnect({
          data: { name: 'Renamed' },
          operation: 'update',
          originalDoc: {
            tenant: 9,
            priceInformation: { price: 10, interval: 'month', intervalCount: 1 },
          } as never,
          req: req as never,
        }),
      ).resolves.toBeDefined()
      expect(req.payload.findByID).not.toHaveBeenCalled()
    })

    it('throws on update when priceInformation is patched and tenant is not connected', async () => {
      const req = makeReq({
        tenant: { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' },
      })
      await expect(
        planBeforeValidateStripeConnect({
          data: { priceInformation: { price: 20, interval: 'month', intervalCount: 1 } },
          operation: 'update',
          originalDoc: {
            tenant: 9,
            priceInformation: { price: 10, interval: 'month', intervalCount: 1 },
          } as never,
          req: req as never,
        }),
      ).rejects.toThrow(/Stripe Connect/i)
    })

    it('allows update when priceInformation is resent unchanged and tenant is not connected', async () => {
      const req = makeReq({
        tenant: { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' },
      })
      await expect(
        planBeforeValidateStripeConnect({
          data: { priceInformation: { price: 10, interval: 'month', intervalCount: 1 } },
          operation: 'update',
          originalDoc: {
            tenant: 9,
            priceInformation: { price: 10, interval: 'month', intervalCount: 1 },
          } as never,
          req: req as never,
        }),
      ).resolves.toBeDefined()
    })
  })

  describe('classPassTypeBeforeValidateStripeConnect', () => {
    it('throws when creating priced class pass type without Connect', async () => {
      const req = makeReq({
        tenant: { stripeConnectAccountId: null, stripeConnectOnboardingStatus: 'not_connected' },
      })
      await expect(
        classPassTypeBeforeValidateStripeConnect({
          data: { tenant: 3, priceInformation: { price: 30 } },
          operation: 'create',
          originalDoc: undefined,
          req: req as never,
        }),
      ).rejects.toThrow(/class pass type/i)
    })
  })
})

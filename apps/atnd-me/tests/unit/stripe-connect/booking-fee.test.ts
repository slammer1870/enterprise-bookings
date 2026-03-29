/**
 * Step 2.7.1 – Booking fee calculation: product-type defaults, overrides, rounding, bounds.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  getEffectiveBookingFeePercent,
  calculateBookingFeeAmount,
  computeFeeCents,
} from '@/lib/stripe-connect/bookingFee'

describe('Booking fee (step 2.7.1)', () => {
  describe('computeFeeCents', () => {
    it('rounds fee by percent (cents)', () => {
      expect(computeFeeCents(1000, 2, null)).toBe(20)
      expect(computeFeeCents(1005, 2, null)).toBe(20)
      expect(computeFeeCents(1010, 2, null)).toBe(20)
      expect(computeFeeCents(1025, 2, null)).toBe(21)
      expect(computeFeeCents(999, 3, null)).toBe(30)
    })

    it('returns 0 when result would be negative (never negative)', () => {
      expect(computeFeeCents(0, 5, null)).toBe(0)
      expect(computeFeeCents(10, 100, null)).toBe(10)
    })

    it('applies optional minCents bound', () => {
      expect(computeFeeCents(100, 1, { minCents: 5, maxCents: null })).toBe(5)
      expect(computeFeeCents(1000, 2, { minCents: 25, maxCents: null })).toBe(25)
      expect(computeFeeCents(2000, 2, { minCents: 25, maxCents: null })).toBe(40)
    })

    it('applies optional maxCents bound', () => {
      expect(computeFeeCents(10000, 5, { minCents: null, maxCents: 100 })).toBe(100)
      expect(computeFeeCents(1000, 2, { minCents: null, maxCents: 50 })).toBe(20)
      expect(computeFeeCents(10000, 10, { minCents: null, maxCents: 200 })).toBe(200)
    })

    it('applies both min and max when provided', () => {
      expect(computeFeeCents(100, 1, { minCents: 5, maxCents: 20 })).toBe(5)
      expect(computeFeeCents(5000, 10, { minCents: 5, maxCents: 200 })).toBe(200)
    })
  })

  describe('getEffectiveBookingFeePercent', () => {
    const tenantId = 1
    const mockPayload = {
      findGlobal: vi.fn(),
    } as unknown as Parameters<typeof getEffectiveBookingFeePercent>[0]['payload']

    beforeEach(() => {
      vi.mocked(mockPayload.findGlobal).mockReset()
    })

    it('returns default 2% for drop-in when global has defaults', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [],
      })
      const pct = await getEffectiveBookingFeePercent({
        tenantId,
        productType: 'drop-in',
        payload: mockPayload,
      })
      expect(pct).toBe(2)
    })

    it('returns default 3% for class-pass and 4% for subscription', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [],
      })
      expect(
        await getEffectiveBookingFeePercent({ tenantId, productType: 'class-pass', payload: mockPayload }),
      ).toBe(3)
      expect(
        await getEffectiveBookingFeePercent({ tenantId, productType: 'subscription', payload: mockPayload }),
      ).toBe(4)
    })

    it('uses built-in defaults when global is null or missing defaults', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue(null)
      expect(await getEffectiveBookingFeePercent({ tenantId, productType: 'drop-in', payload: mockPayload })).toBe(2)
      expect(await getEffectiveBookingFeePercent({ tenantId, productType: 'class-pass', payload: mockPayload })).toBe(
        3,
      )
      expect(await getEffectiveBookingFeePercent({ tenantId, productType: 'subscription', payload: mockPayload })).toBe(
        4,
      )
    })

    it('applies per-tenant override when present (override > default)', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [{ tenant: tenantId, dropInPercent: 5, classPassPercent: null, subscriptionPercent: null }],
      })
      expect(
        await getEffectiveBookingFeePercent({ tenantId, productType: 'drop-in', payload: mockPayload }),
      ).toBe(5)
      expect(
        await getEffectiveBookingFeePercent({ tenantId, productType: 'class-pass', payload: mockPayload }),
      ).toBe(3)
    })

    it('uses default for tenant with no override', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [{ tenant: 999, dropInPercent: 10, classPassPercent: null, subscriptionPercent: null }],
      })
      expect(
        await getEffectiveBookingFeePercent({ tenantId, productType: 'drop-in', payload: mockPayload }),
      ).toBe(2)
    })
  })

  describe('calculateBookingFeeAmount', () => {
    const tenantId = 1
    const mockPayload = {
      findGlobal: vi.fn(),
    } as unknown as Parameters<typeof calculateBookingFeeAmount>[0]['payload']

    beforeEach(() => {
      vi.mocked(mockPayload.findGlobal).mockReset()
    })

    it('computes fee from percent and applies bounds from global', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [],
        bounds: { minCents: 10, maxCents: 500 },
      })
      const fee = await calculateBookingFeeAmount({
        tenantId,
        productType: 'drop-in',
        classPriceAmount: 1000,
        payload: mockPayload,
      })
      expect(fee).toBe(20)
    })

    it('clamps to minCents when computed fee is below min', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 1, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [],
        bounds: { minCents: 15, maxCents: null },
      })
      const fee = await calculateBookingFeeAmount({
        tenantId,
        productType: 'drop-in',
        classPriceAmount: 1000,
        payload: mockPayload,
      })
      expect(fee).toBe(15)
    })

    it('clamps to maxCents when computed fee is above max', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 10, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [],
        bounds: { minCents: null, maxCents: 50 },
      })
      const fee = await calculateBookingFeeAmount({
        tenantId,
        productType: 'drop-in',
        classPriceAmount: 1000,
        payload: mockPayload,
      })
      expect(fee).toBe(50)
    })

    it('uses tenant override percent when resolving fee', async () => {
      vi.mocked(mockPayload.findGlobal).mockResolvedValue({
        defaults: { dropInPercent: 2, classPassPercent: 3, subscriptionPercent: 4 },
        overrides: [{ tenant: tenantId, dropInPercent: 5, classPassPercent: null, subscriptionPercent: null }],
        bounds: null,
      })
      const fee = await calculateBookingFeeAmount({
        tenantId,
        productType: 'drop-in',
        classPriceAmount: 1000,
        payload: mockPayload,
      })
      expect(fee).toBe(50)
    })
  })
})

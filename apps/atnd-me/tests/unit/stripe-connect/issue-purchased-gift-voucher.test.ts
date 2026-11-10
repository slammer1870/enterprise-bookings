import { describe, expect, it, vi } from 'vitest'

import { issuePurchasedGiftVoucher } from '@/lib/stripe-connect/issuePurchasedGiftVoucher'

describe('issuePurchasedGiftVoucher', () => {
  it('stores the sale branch on the discount code', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 5,
      code: 'GIFTABC',
      value: 50,
      redeemBy: '2031-01-01',
    })
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create,
      sendEmail: vi.fn().mockResolvedValue(undefined),
      findByID: vi.fn().mockResolvedValue(null),
      logger: { error: vi.fn() },
    }

    const result = await issuePurchasedGiftVoucher({
      payload: payload as never,
      tenantId: 3,
      paymentIntentId: 'pi_gift',
      amountEuros: 50,
      purchaserEmail: 'buyer@example.com',
      branchId: 42,
    })

    expect(result.issued).toBe(true)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'discount-codes',
        data: expect.objectContaining({ branch: 42 }),
      }),
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { issueSubscriptionGiftBalanceIfNeeded } from '@/lib/stripe-connect/issueSubscriptionGiftBalance'

const createBalanceTransaction = vi.fn()

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    customers: { createBalanceTransaction },
  }),
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: (id: string) => id.startsWith('acct_e2e_'),
}))

function makePayload(parent: Record<string, unknown> | null) {
  const find = vi.fn(async ({ where }: { where?: { and?: Array<Record<string, unknown>> } }) => {
    const and = where?.and ?? []
    const codeClause = and.find((c) => 'code' in c) as { code?: { equals?: string } } | undefined
    if (typeof codeClause?.code?.equals === 'string' && parent) {
      if (String(parent.code).toUpperCase() === codeClause.code.equals.toUpperCase()) {
        return { docs: [parent] }
      }
      return { docs: [] }
    }
    return { docs: parent ? [parent] : [] }
  })

  const update = vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
    if (parent && parent.id === id) Object.assign(parent, data)
    return { id, ...parent, ...data }
  })

  return {
    find,
    update,
    sendEmail: vi.fn().mockResolvedValue(undefined),
    logger: { error: vi.fn(), warn: vi.fn() },
  }
}

describe('issueSubscriptionGiftBalanceIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createBalanceTransaction.mockResolvedValue({ id: 'cbtxn_1' })
  })

  it('credits leftover vs plan price only (€150 on €100 → €50 / 5000 cents)', async () => {
    const parent = {
      id: 10,
      code: 'GIFT150',
      type: 'amount_off',
      value: 150,
      currency: 'eur',
      maxRedemptions: 1,
      giftBalanceCreditKey: null,
      status: 'active',
    }
    const payload = makePayload(parent)

    const result = await issueSubscriptionGiftBalanceIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT150',
      planPriceBeforeDiscount: 100,
      stripeCustomerId: 'cus_1',
      stripeAccountId: 'acct_live_real',
      subscriptionId: 'sub_1',
      userId: 5,
      userEmail: 'user@example.com',
    })

    expect(result).toMatchObject({
      credited: true,
      remainderValue: 50,
      remainderCents: 5000,
      idempotent: false,
      balanceTransactionId: 'cbtxn_1',
    })
    expect(createBalanceTransaction).toHaveBeenCalledWith(
      'cus_1',
      expect.objectContaining({
        amount: -5000,
        currency: 'eur',
      }),
      { stripeAccount: 'acct_live_real' },
    )
    expect(parent.giftBalanceCreditKey).toBe('sub_1')
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining('50.00'),
      }),
    )
  })

  it('skips when coupon equals plan (no leftover)', async () => {
    const payload = makePayload({
      id: 10,
      code: 'GIFT100',
      type: 'amount_off',
      value: 100,
      currency: 'eur',
      maxRedemptions: 1,
      giftBalanceCreditKey: null,
    })

    const result = await issueSubscriptionGiftBalanceIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT100',
      planPriceBeforeDiscount: 100,
      stripeCustomerId: 'cus_1',
      stripeAccountId: 'acct_live_real',
      subscriptionId: 'sub_1',
      userId: 5,
    })

    expect(result).toEqual({ credited: false, reason: 'no_remainder' })
    expect(createBalanceTransaction).not.toHaveBeenCalled()
  })

  it('skips non amount_off and maxRedemptions != 1', async () => {
    const pct = makePayload({
      id: 1,
      code: 'PCT',
      type: 'percentage_off',
      value: 50,
      maxRedemptions: 1,
    })
    expect(
      await issueSubscriptionGiftBalanceIfNeeded({
        payload: pct as never,
        tenantId: 1,
        discountCode: 'PCT',
        planPriceBeforeDiscount: 100,
        stripeCustomerId: 'cus_1',
        stripeAccountId: 'acct_live_real',
        subscriptionId: 'sub_1',
        userId: 5,
      }),
    ).toEqual({ credited: false, reason: 'not_amount_off' })

    const multi = makePayload({
      id: 2,
      code: 'MULTI',
      type: 'amount_off',
      value: 150,
      maxRedemptions: 5,
    })
    expect(
      await issueSubscriptionGiftBalanceIfNeeded({
        payload: multi as never,
        tenantId: 1,
        discountCode: 'MULTI',
        planPriceBeforeDiscount: 100,
        stripeCustomerId: 'cus_1',
        stripeAccountId: 'acct_live_real',
        subscriptionId: 'sub_1',
        userId: 5,
      }),
    ).toEqual({ credited: false, reason: 'max_redemptions_not_one' })
  })

  it('is idempotent for the same subscriptionId', async () => {
    const parent = {
      id: 10,
      code: 'GIFT150',
      type: 'amount_off',
      value: 150,
      currency: 'eur',
      maxRedemptions: 1,
      giftBalanceCreditKey: 'sub_1',
    }
    const payload = makePayload(parent)

    const result = await issueSubscriptionGiftBalanceIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT150',
      planPriceBeforeDiscount: 100,
      stripeCustomerId: 'cus_1',
      stripeAccountId: 'acct_live_real',
      subscriptionId: 'sub_1',
      userId: 5,
    })

    expect(result).toMatchObject({ credited: true, idempotent: true, remainderCents: 5000 })
    expect(createBalanceTransaction).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('short-circuits Stripe for e2e test Connect accounts', async () => {
    const parent = {
      id: 10,
      code: 'GIFT150',
      type: 'amount_off',
      value: 150,
      currency: 'eur',
      maxRedemptions: 1,
      giftBalanceCreditKey: null,
    }
    const payload = makePayload(parent)

    const result = await issueSubscriptionGiftBalanceIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT150',
      planPriceBeforeDiscount: 100,
      stripeCustomerId: 'cus_1',
      stripeAccountId: 'acct_e2e_connected_1',
      subscriptionId: 'sub_test',
      userId: 5,
    })

    expect(result.credited).toBe(true)
    if (!result.credited) return
    expect(result.balanceTransactionId).toMatch(/^cbtxn_test_/)
    expect(createBalanceTransaction).not.toHaveBeenCalled()
    expect(parent.giftBalanceCreditKey).toBe('sub_test')
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  handleClassPassGiftRemainder,
  handleSubscriptionGiftBalance,
  planPriceEurosFromMetadata,
} from '@/lib/stripe-connect/webhook/checkout-gift-credit'

const consumeDiscountCodeRedemption = vi.fn()
const issueRemainderDiscountCodeIfNeeded = vi.fn()
const issueSubscriptionGiftBalanceIfNeeded = vi.fn()

vi.mock('@/lib/stripe-connect/discountCodes', () => ({
  consumeDiscountCodeRedemption: (...args: unknown[]) => consumeDiscountCodeRedemption(...args),
}))

vi.mock('@/lib/stripe-connect/issueRemainderDiscountCode', () => ({
  issueRemainderDiscountCodeIfNeeded: (...args: unknown[]) =>
    issueRemainderDiscountCodeIfNeeded(...args),
}))

vi.mock('@/lib/stripe-connect/issueSubscriptionGiftBalance', () => ({
  issueSubscriptionGiftBalanceIfNeeded: (...args: unknown[]) =>
    issueSubscriptionGiftBalanceIfNeeded(...args),
}))

describe('planPriceEurosFromMetadata', () => {
  it('prefers classPriceBeforeDiscount euros', () => {
    expect(
      planPriceEurosFromMetadata({
        classPriceBeforeDiscount: '100',
        planPriceAmount: '10500',
        bookingFeeAmount: '500',
      }),
    ).toBe(100)
  })

  it('falls back to planPriceAmount cents (ignores fee)', () => {
    expect(
      planPriceEurosFromMetadata({
        planPriceAmount: '10000',
        bookingFeeAmount: '500',
      }),
    ).toBe(100)
  })
})

describe('handleClassPassGiftRemainder', () => {
  it('consumes and issues remainder from plan price', async () => {
    consumeDiscountCodeRedemption.mockResolvedValue({ ok: true, timesRedeemed: 1, archived: true })
    issueRemainderDiscountCodeIfNeeded.mockResolvedValue({ issued: true, remainderValue: 11 })

    const payload = {
      findByID: vi.fn().mockResolvedValue({ email: 'u@example.com' }),
      logger: { error: vi.fn() },
    }

    await handleClassPassGiftRemainder({
      payload: payload as never,
      tenantId: 1,
      userId: 9,
      paymentIntentId: 'pi_1',
      metadata: {
        discountCode: 'GIFT30',
        planPriceAmount: '1900',
        bookingFeeAmount: '50',
      },
    })

    expect(consumeDiscountCodeRedemption).toHaveBeenCalledWith(
      expect.objectContaining({
        discountCode: 'GIFT30',
        idempotencyKey: 'pi_1',
      }),
    )
    expect(issueRemainderDiscountCodeIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        classPriceBeforeDiscount: 19,
        paymentIntentId: 'pi_1',
        userEmail: 'u@example.com',
      }),
    )
  })

  it('skips remainder when coupon meta missing plan price', async () => {
    consumeDiscountCodeRedemption.mockResolvedValue({ ok: true })
    issueRemainderDiscountCodeIfNeeded.mockClear()

    await handleClassPassGiftRemainder({
      payload: { findByID: vi.fn(), logger: { error: vi.fn() } } as never,
      tenantId: 1,
      userId: 9,
      paymentIntentId: 'pi_1',
      metadata: { discountCode: 'GIFT30' },
    })

    expect(issueRemainderDiscountCodeIfNeeded).not.toHaveBeenCalled()
  })
})

describe('handleSubscriptionGiftBalance', () => {
  it('credits when status active and leftover exists', async () => {
    consumeDiscountCodeRedemption.mockResolvedValue({ ok: true })
    issueSubscriptionGiftBalanceIfNeeded.mockResolvedValue({ credited: true })

    const payload = {
      findByID: vi.fn().mockResolvedValue({ email: 'u@example.com' }),
      logger: { error: vi.fn() },
    }

    await handleSubscriptionGiftBalance({
      payload: payload as never,
      tenantId: 1,
      userId: 9,
      subscriptionId: 'sub_1',
      stripeCustomerId: 'cus_1',
      stripeAccountId: 'acct_1',
      stripeStatus: 'active',
      metadata: {
        discountCode: 'GIFT150',
        planPriceAmount: '10000',
        bookingFeeAmount: '500',
      },
    })

    expect(issueSubscriptionGiftBalanceIfNeeded).toHaveBeenCalledWith(
      expect.objectContaining({
        planPriceBeforeDiscount: 100,
        subscriptionId: 'sub_1',
        stripeCustomerId: 'cus_1',
      }),
    )
  })

  it('skips incomplete subscriptions', async () => {
    issueSubscriptionGiftBalanceIfNeeded.mockClear()

    await handleSubscriptionGiftBalance({
      payload: { findByID: vi.fn(), logger: { error: vi.fn() } } as never,
      tenantId: 1,
      userId: 9,
      subscriptionId: 'sub_1',
      stripeCustomerId: 'cus_1',
      stripeAccountId: 'acct_1',
      stripeStatus: 'incomplete',
      metadata: { discountCode: 'GIFT150', planPriceAmount: '10000' },
    })

    expect(issueSubscriptionGiftBalanceIfNeeded).not.toHaveBeenCalled()
  })
})

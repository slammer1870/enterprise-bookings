/**
 * After a subscription Checkout uses an amount_off / maxRedemptions=1 gift code for less
 * than its full value (plan price only), credit the leftover to the Stripe customer balance
 * so later invoices draw it down automatically. Does not issue a remainder discount code.
 */
import type { Payload } from 'payload'

import { normalizeDiscountCode } from '@/lib/stripe-connect/discountCodes'
import { computeRemainderAmount } from '@/lib/stripe-connect/issueRemainderDiscountCode'
import { getPlatformStripe } from '@/lib/stripe/platform'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'

export type IssueSubscriptionGiftBalanceParams = {
  payload: Payload
  tenantId: number
  discountCode: string
  /** Plan price in euros before the promo (exclude platform fee) */
  planPriceBeforeDiscount: number
  stripeCustomerId: string
  stripeAccountId: string
  /** Idempotency key — typically the Stripe subscription id */
  subscriptionId: string
  userId: number
  userEmail?: string | null
  currency?: string | null
}

export type IssueSubscriptionGiftBalanceResult =
  | {
      credited: true
      remainderValue: number
      remainderCents: number
      idempotent: boolean
      balanceTransactionId?: string
    }
  | { credited: false; reason: string }

type ParentDiscountDoc = {
  id: number
  code?: string | null
  type?: string | null
  value?: number | null
  currency?: string | null
  maxRedemptions?: number | null
  giftBalanceCreditKey?: string | null
  status?: string | null
}

async function findParentByCode(
  payload: Payload,
  tenantId: number,
  code: string,
): Promise<ParentDiscountDoc | null> {
  const normalized = normalizeDiscountCode(code)
  if (!normalized) return null

  const match = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 5,
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { code: { equals: normalized } },
      ],
    },
  })

  const exact = match.docs[0] as ParentDiscountDoc | undefined
  if (exact) return exact

  const legacy = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    where: {
      and: [{ tenant: { equals: tenantId } }],
    },
  })

  return (
    (legacy.docs.find(
      (d) => normalizeDiscountCode(String((d as ParentDiscountDoc).code ?? '')) === normalized,
    ) as ParentDiscountDoc | undefined) ?? null
  )
}

export async function issueSubscriptionGiftBalanceIfNeeded(
  params: IssueSubscriptionGiftBalanceParams,
): Promise<IssueSubscriptionGiftBalanceResult> {
  const {
    payload,
    tenantId,
    discountCode,
    planPriceBeforeDiscount,
    stripeCustomerId,
    stripeAccountId,
    subscriptionId,
    userId,
    userEmail,
    currency,
  } = params

  const subKey = typeof subscriptionId === 'string' ? subscriptionId.trim() : ''
  const customerId = typeof stripeCustomerId === 'string' ? stripeCustomerId.trim() : ''
  const accountId = typeof stripeAccountId === 'string' ? stripeAccountId.trim() : ''

  if (!subKey || !customerId || !accountId) {
    return { credited: false, reason: 'invalid_args' }
  }

  const parent = await findParentByCode(payload, tenantId, discountCode)
  if (!parent) {
    return { credited: false, reason: 'parent_not_found' }
  }

  if (parent.type !== 'amount_off') {
    return { credited: false, reason: 'not_amount_off' }
  }

  if (parent.maxRedemptions !== 1) {
    return { credited: false, reason: 'max_redemptions_not_one' }
  }

  if (typeof parent.value !== 'number' || !(parent.value > 0)) {
    return { credited: false, reason: 'invalid_value' }
  }

  if (
    typeof parent.giftBalanceCreditKey === 'string' &&
    parent.giftBalanceCreditKey === subKey
  ) {
    const remainderValue = computeRemainderAmount(parent.value, planPriceBeforeDiscount)
    return {
      credited: true,
      remainderValue,
      remainderCents: Math.round(remainderValue * 100),
      idempotent: true,
    }
  }

  const remainderValue = computeRemainderAmount(parent.value, planPriceBeforeDiscount)
  if (remainderValue <= 0) {
    return { credited: false, reason: 'no_remainder' }
  }

  const remainderCents = Math.round(remainderValue * 100)
  if (remainderCents <= 0) {
    return { credited: false, reason: 'no_remainder' }
  }

  const currencyClean = (
    typeof currency === 'string' && currency.trim()
      ? currency
      : typeof parent.currency === 'string' && parent.currency.trim()
        ? parent.currency
        : 'eur'
  )
    .trim()
    .toLowerCase()

  let balanceTransactionId: string | undefined

  const isE2e =
    process.env.ENABLE_TEST_WEBHOOKS === 'true' || process.env.NODE_ENV === 'test'
  if (isStripeTestAccount(accountId) || (isE2e && /^acct_[a-z_]+_\d+$/.test(accountId))) {
    balanceTransactionId = `cbtxn_test_${Date.now()}`
  } else {
    try {
      const stripe = getPlatformStripe()
      // Negative amount = credit to the customer (applied to future invoices).
      const txn = await stripe.customers.createBalanceTransaction(
        customerId,
        {
          amount: -remainderCents,
          currency: currencyClean,
          description: `Gift credit remainder from ${normalizeDiscountCode(discountCode)} (${subKey})`,
          metadata: {
            tenantId: String(tenantId),
            discountCode: normalizeDiscountCode(discountCode),
            subscriptionId: subKey,
            source: 'subscription_gift_remainder',
          },
        },
        { stripeAccount: accountId },
      )
      balanceTransactionId = txn.id
    } catch (err) {
      payload.logger?.error?.(
        `issueSubscriptionGiftBalanceIfNeeded: balance credit failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      return { credited: false, reason: 'stripe_failed' }
    }
  }

  try {
    await payload.update({
      collection: 'discount-codes',
      id: parent.id,
      data: { giftBalanceCreditKey: subKey },
      overrideAccess: true,
      context: { skipStripeSync: true },
    })
  } catch (err) {
    payload.logger?.error?.(
      `issueSubscriptionGiftBalanceIfNeeded: failed to persist giftBalanceCreditKey: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  const email = typeof userEmail === 'string' ? userEmail.trim() : ''
  if (email) {
    try {
      await payload.sendEmail({
        to: email,
        subject: `€${remainderValue.toFixed(2)} gift credit applied to your membership`,
        html: `
          <p>Hi,</p>
          <p>You used a gift code worth more than your first membership payment. The unused balance of
          <strong>€${remainderValue.toFixed(2)}</strong> has been credited to your account and will
          automatically reduce future membership invoices until it runs out.</p>
          <p>No new discount code is needed.</p>
        `,
      })
    } catch (emailErr) {
      payload.logger?.error?.(
        `issueSubscriptionGiftBalanceIfNeeded: email failed for user ${userId}: ${
          emailErr instanceof Error ? emailErr.message : String(emailErr)
        }`,
      )
    }
  }

  return {
    credited: true,
    remainderValue,
    remainderCents,
    idempotent: false,
    balanceTransactionId,
  }
}

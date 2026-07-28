/**
 * Create a PaymentIntent for purchasing a gift voucher (face-value amount_off code).
 * Charges voucher face value + platform fee; fee is collected via application_fee_amount
 * on a Connect direct charge. Always on the tenant Connect account (logged-in or guest)
 * so Payment Element can mount with `{ stripeAccount }`.
 */
import type { Payload } from 'payload'
import { getPlatformStripe } from '@/lib/stripe/platform'
import {
  requireTenantConnectAccount,
  getTenantStripeContext,
  type TenantStripeLike,
} from '@/lib/stripe-connect/tenantStripe'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'
import {
  GIFT_VOUCHER_PURCHASE_TYPE,
} from '@/lib/stripe-connect/giftVoucherConstants'

export {
  GIFT_VOUCHER_MIN_EUROS,
  GIFT_VOUCHER_MAX_EUROS,
  GIFT_VOUCHER_PURCHASE_TYPE,
  validateGiftVoucherAmount,
} from '@/lib/stripe-connect/giftVoucherConstants'

export type CreateGiftVoucherPaymentIntentParams = {
  tenant: TenantStripeLike & { id: number }
  /** Voucher face value in euros (major units), e.g. 25.00 — issued code matches this. */
  amountEuros: number
  currency?: string
  purchaserEmail: string
  purchaserName: string
  userId?: number | null
  customerId?: string | null
  payload: Payload
}

export type CreateGiftVoucherPaymentIntentResult = {
  id: string
  client_secret: string | null
  /** Voucher face value in cents */
  voucherAmountCents: number
  /** Platform fee in cents */
  bookingFeeAmountCents: number
  /** Total charged to the customer in cents */
  totalAmountCents: number
}

export async function createGiftVoucherPaymentIntent(
  params: CreateGiftVoucherPaymentIntentParams,
): Promise<CreateGiftVoucherPaymentIntentResult> {
  const {
    tenant,
    amountEuros,
    currency = 'eur',
    purchaserEmail,
    purchaserName,
    userId,
    customerId,
    payload,
  } = params

  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) {
    throw new Error('Tenant Connect account id is missing')
  }

  const voucherAmountCents = Math.round(amountEuros * 100)
  const bookingFeeAmountCents = await calculateBookingFeeAmount({
    payload,
    tenantId: tenant.id,
    productType: 'gift-voucher',
    classPriceAmount: voucherAmountCents,
  })
  const totalAmountCents = voucherAmountCents + bookingFeeAmountCents
  const receiptEmail = purchaserEmail.trim()

  const meta: Record<string, string> = {
    type: GIFT_VOUCHER_PURCHASE_TYPE,
    tenantId: String(tenant.id),
    // Face value only — webhook issues a discount code for this amount (fee excluded).
    amountEuros: amountEuros.toFixed(2),
    voucherAmountCents: String(voucherAmountCents),
    bookingFeeAmount: String(bookingFeeAmountCents),
    purchaserEmail: receiptEmail,
    purchaserName: purchaserName.trim(),
  }
  if (userId != null && Number.isFinite(userId) && userId > 0) {
    meta.userId = String(userId)
  }

  if (isStripeTestAccount(accountId)) {
    const mockId = `pi_test_${Date.now()}`
    return {
      id: mockId,
      client_secret: `${mockId}_secret_test`,
      voucherAmountCents,
      bookingFeeAmountCents,
      totalAmountCents,
    }
  }

  const stripe = getPlatformStripe()
  const hasCustomer = typeof customerId === 'string' && customerId.trim().length > 0

  // Direct charge on the connected account; platform keeps the fee via application_fee_amount.
  const pi = await stripe.paymentIntents.create(
    {
      amount: totalAmountCents,
      currency,
      automatic_payment_methods: { enabled: true },
      ...(hasCustomer ? { customer: customerId!.trim() } : {}),
      ...(bookingFeeAmountCents > 0 ? { application_fee_amount: bookingFeeAmountCents } : {}),
      receipt_email: receiptEmail,
      metadata: meta,
    },
    { stripeAccount: accountId },
  )
  return {
    id: pi.id,
    client_secret: pi.client_secret,
    voucherAmountCents,
    bookingFeeAmountCents,
    totalAmountCents,
  }
}

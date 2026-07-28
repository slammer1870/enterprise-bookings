/**
 * Create a PaymentIntent for purchasing a gift voucher (face-value amount_off code).
 * No platform booking fee — amount charged equals voucher value.
 */
import { getPlatformStripe } from '@/lib/stripe/platform'
import {
  requireTenantConnectAccount,
  getTenantStripeContext,
  type TenantStripeLike,
} from '@/lib/stripe-connect/tenantStripe'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
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
  /** Amount in euros (major units), e.g. 25.00 */
  amountEuros: number
  currency?: string
  purchaserEmail: string
  purchaserName: string
  userId?: number | null
  customerId?: string | null
}

export type CreateGiftVoucherPaymentIntentResult = {
  id: string
  client_secret: string | null
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
  } = params

  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) {
    throw new Error('Tenant Connect account id is missing')
  }

  const amountCents = Math.round(amountEuros * 100)
  const receiptEmail = purchaserEmail.trim()

  const meta: Record<string, string> = {
    type: GIFT_VOUCHER_PURCHASE_TYPE,
    tenantId: String(tenant.id),
    amountEuros: amountEuros.toFixed(2),
    purchaserEmail: receiptEmail,
    purchaserName: purchaserName.trim(),
  }
  if (userId != null && Number.isFinite(userId) && userId > 0) {
    meta.userId = String(userId)
  }

  if (isStripeTestAccount(accountId)) {
    const mockId = `pi_test_${Date.now()}`
    return { id: mockId, client_secret: `${mockId}_secret_test` }
  }

  const stripe = getPlatformStripe()
  const hasCustomer = typeof customerId === 'string' && customerId.trim().length > 0

  if (hasCustomer) {
    // Direct charge on connected account (no application fee — face value).
    const pi = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        automatic_payment_methods: { enabled: true },
        customer: customerId!.trim(),
        receipt_email: receiptEmail,
        metadata: meta,
      },
      { stripeAccount: accountId },
    )
    return { id: pi.id, client_secret: pi.client_secret }
  }

  // Destination charge: full amount transfers to connected account (no platform fee).
  const pi = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    on_behalf_of: accountId,
    transfer_data: { destination: accountId },
    receipt_email: receiptEmail,
    metadata: meta,
  })

  return { id: pi.id, client_secret: pi.client_secret }
}

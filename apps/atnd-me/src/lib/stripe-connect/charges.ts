/**
 * Step 2.7 – Payment routing: create PaymentIntent on behalf of tenant (destination charges).
 * Step 2.7.1 – Optional productType + payload to compute booking fee from platform-fees global.
 */
import type { Payload } from 'payload'
import { getPlatformStripe } from '@/lib/stripe/platform'
import {
  requireTenantConnectAccount,
  getTenantStripeContext,
  type TenantStripeLike,
} from '@/lib/stripe-connect/tenantStripe'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { calculateBookingFeeAmount, type BookingFeeProductType } from '@/lib/stripe-connect/bookingFee'

export type CreateTenantPaymentIntentParams = {
  tenant: TenantStripeLike & { id?: number }
  classPriceAmount: number
  currency: string
  /**
   * Customer ID in the tenant's connected Stripe account.
   * When provided, the PaymentIntent will be created on the connected account and attached to this customer.
   */
  customerId?: string | null
  metadata: Record<string, string> & {
    tenantId?: string
    bookingId?: string
  }
} & (
  | { bookingFeeAmount: number }
  | { productType: BookingFeeProductType; payload: Payload }
)

/**
 * Creates a PaymentIntent on the platform account with destination charge to the tenant.
 * - amount = classPriceAmount + bookingFeeAmount
 * - application_fee_amount = bookingFeeAmount (platform keeps booking fee)
 * - transfer_data.destination = tenant's Connect account (tenant receives class price)
 * - When productType and payload are provided, bookingFeeAmount is computed from platform-fees global.
 */
export async function createTenantPaymentIntent(
  params: CreateTenantPaymentIntentParams,
): Promise<{ id: string; client_secret: string | null }> {
  const { tenant, classPriceAmount, currency, metadata, customerId } = params
  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) {
    throw new Error('Tenant Connect account id is missing')
  }

  const isE2eTestMode =
    process.env.ENABLE_TEST_WEBHOOKS === 'true' || process.env.NODE_ENV === 'test'
  if (isStripeTestAccount(accountId) || (isE2eTestMode && /^acct_[a-z_]+_\d+$/.test(accountId))) {
    const mockId = `pi_test_${Date.now()}`
    return { id: mockId, client_secret: `${mockId}_secret_test` }
  }

  const bookingFeeAmount =
    'bookingFeeAmount' in params
      ? params.bookingFeeAmount
      : await calculateBookingFeeAmount({
          tenantId: tenant.id!,
          productType: params.productType,
          classPriceAmount,
          payload: params.payload,
        })

  const amount = classPriceAmount + bookingFeeAmount
  const stripe = getPlatformStripe()

  const meta: Record<string, string> = {
    ...metadata,
    classPriceAmount: String(classPriceAmount),
    bookingFeeAmount: String(bookingFeeAmount),
  }
  if (tenant.id != null) {
    meta.tenantId = String(tenant.id)
  }

  const hasCustomer = typeof customerId === 'string' && customerId.trim().length > 0

  if (hasCustomer) {
    // Direct charge on the connected account so the PI can be attached to the tenant's customer.
    // Platform still collects booking fee via application_fee_amount.
    const pi = await stripe.paymentIntents.create(
      {
        amount,
        currency,
        automatic_payment_methods: { enabled: true },
        application_fee_amount: bookingFeeAmount,
        customer: customerId!.trim(),
        metadata: meta,
      },
      { stripeAccount: accountId },
    )
    return { id: pi.id, client_secret: pi.client_secret }
  }

  // Destination charge on the platform account: funds go to platform, then transfer to connected account.
  const pi = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    application_fee_amount: bookingFeeAmount,
    on_behalf_of: accountId,
    transfer_data: { destination: accountId },
    metadata: meta,
  })

  return {
    id: pi.id,
    client_secret: pi.client_secret,
  }
}

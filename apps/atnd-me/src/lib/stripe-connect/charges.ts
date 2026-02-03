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
import { calculateBookingFeeAmount, type BookingFeeProductType } from '@/lib/stripe-connect/bookingFee'

export type CreateTenantPaymentIntentParams = {
  tenant: TenantStripeLike & { id?: number }
  classPriceAmount: number
  currency: string
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
  const { tenant, classPriceAmount, currency, metadata } = params
  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) {
    throw new Error('Tenant Connect account id is missing')
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

  const pi = await stripe.paymentIntents.create({
    amount,
    currency,
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

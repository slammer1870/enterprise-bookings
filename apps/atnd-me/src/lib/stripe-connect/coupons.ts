/**
 * Phase 4.5 – Create/deactivate Stripe Coupons and Promotion Codes on tenant Connect account.
 */
import { getPlatformStripe } from '@/lib/stripe/platform'
import {
  requireTenantConnectAccount,
  getTenantStripeContext,
  type TenantStripeLike,
} from '@/lib/stripe-connect/tenantStripe'

export type CreateTenantCouponParams = {
  tenant: TenantStripeLike & { id?: number }
  percent_off?: number // 1-100
  amount_off?: number // cents
  currency?: string // required when amount_off
  duration: 'once' | 'repeating' | 'forever'
  duration_in_months?: number // required when duration === 'repeating'
  max_redemptions?: number
  redeem_by?: number // Unix timestamp
}

export type CreateTenantCouponAndPromoCodeParams = CreateTenantCouponParams & {
  code: string // customer-facing e.g. SUMMER20
}

export type CreateTenantCouponAndPromoCodeResult = {
  couponId: string
  promotionCodeId: string
}

/**
 * Create a Stripe Coupon and Promotion Code on the tenant's Connect account.
 */
export async function createTenantCouponAndPromoCode(
  params: CreateTenantCouponAndPromoCodeParams,
): Promise<CreateTenantCouponAndPromoCodeResult> {
  const { tenant, code, duration, duration_in_months, max_redemptions, redeem_by, ...rest } = params
  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) throw new Error('Tenant Connect account id is missing')

  const stripe = getPlatformStripe()

  if (rest.percent_off == null && rest.amount_off == null) {
    throw new Error('Either percent_off or amount_off is required')
  }
  if (rest.amount_off != null && !rest.currency) {
    throw new Error('currency is required when amount_off is set')
  }

  const couponParams: Parameters<typeof stripe.coupons.create>[0] = {
    duration,
    ...(duration === 'repeating' && duration_in_months != null && { duration_in_months }),
    ...(max_redemptions != null && { max_redemptions }),
    ...(redeem_by != null && { redeem_by }),
    ...(rest.percent_off != null ? { percent_off: rest.percent_off } : {}),
    ...(rest.amount_off != null
      ? { amount_off: rest.amount_off, currency: (rest.currency ?? 'eur').toLowerCase() }
      : {}),
  }
  const coupon = await stripe.coupons.create(couponParams, { stripeAccount: accountId })

  const promo = await stripe.promotionCodes.create(
    { coupon: coupon.id, code: code.toUpperCase() },
    { stripeAccount: accountId },
  )

  return { couponId: coupon.id, promotionCodeId: promo.id }
}

/**
 * Deactivate a Promotion Code on the tenant's Connect account.
 */
export async function deactivateTenantPromotionCode(
  tenant: TenantStripeLike & { id?: number },
  promotionCodeId: string,
): Promise<void> {
  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) throw new Error('Tenant Connect account id is missing')

  const stripe = getPlatformStripe()
  await stripe.promotionCodes.update(
    promotionCodeId,
    { active: false },
    { stripeAccount: accountId },
  )
}

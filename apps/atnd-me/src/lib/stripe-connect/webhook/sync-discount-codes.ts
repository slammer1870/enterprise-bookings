/**
 * Stripe → Payload: coupons and promotion codes on connected accounts.
 * Used by /api/stripe/webhook; updates use context.stripeWebhookSync to bypass immutable-field locks.
 */
import type Stripe from 'stripe'
import type { Payload } from 'payload'

import { getPlatformStripe } from '@/lib/stripe/platform'

export type StripeCouponLike = {
  id?: string
  object?: string
  percent_off?: number | null
  amount_off?: number | null
  currency?: string | null
  duration?: Stripe.Coupon.Duration | null
  duration_in_months?: number | null
  max_redemptions?: number | null
  redeem_by?: number | null
  name?: string | null
}

export type StripePromotionCodeLike = {
  id?: string
  object?: string
  code?: string | null
  active?: boolean | null
  coupon?: string | Stripe.Coupon | Stripe.DeletedCoupon | null
}

function redeemByToDateString(unix: number | null | undefined): string | null {
  if (unix == null) return null
  return new Date(unix * 1000).toISOString().slice(0, 10)
}

/** Map Stripe coupon fields to Payload discount-codes shape (value in currency units for amount_off). */
export function mapStripeCouponToPayloadFields(coupon: StripeCouponLike): {
  type: 'percentage_off' | 'amount_off'
  value: number
  currency: string | null
  duration: 'once' | 'repeating' | 'forever'
  durationInMonths: number | null
  maxRedemptions: number | null
  redeemBy: string | null
} {
  const duration = coupon.duration ?? 'once'
  const durationPayload =
    duration === 'once' || duration === 'repeating' || duration === 'forever'
      ? duration
      : 'once'

  if (coupon.percent_off != null) {
    return {
      type: 'percentage_off',
      value: coupon.percent_off,
      currency: null,
      duration: durationPayload,
      durationInMonths:
        durationPayload === 'repeating' && coupon.duration_in_months != null
          ? Number(coupon.duration_in_months)
          : null,
      maxRedemptions: coupon.max_redemptions ?? null,
      redeemBy: redeemByToDateString(coupon.redeem_by ?? null),
    }
  }

  if (coupon.amount_off != null) {
    return {
      type: 'amount_off',
      value: Math.round(coupon.amount_off) / 100,
      currency: (coupon.currency ?? 'eur').toLowerCase(),
      duration: durationPayload,
      durationInMonths:
        durationPayload === 'repeating' && coupon.duration_in_months != null
          ? Number(coupon.duration_in_months)
          : null,
      maxRedemptions: coupon.max_redemptions ?? null,
      redeemBy: redeemByToDateString(coupon.redeem_by ?? null),
    }
  }

  throw new Error('Stripe coupon has neither percent_off nor amount_off')
}

function promotionCodeStatusFromStripe(active: boolean | null | undefined): 'active' | 'archived' {
  return active === false ? 'archived' : 'active'
}

async function findDiscountDocByStripeIds(
  payload: Payload,
  tenantId: number,
  params: { stripePromotionCodeId?: string | null; stripeCouponId?: string | null },
): Promise<{ id: number } | null> {
  if (params.stripePromotionCodeId) {
    const byPromo = await payload.find({
      collection: 'discount-codes',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { stripePromotionCodeId: { equals: params.stripePromotionCodeId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { id: true } as any,
    })
    const doc = byPromo.docs[0] as { id: number } | undefined
    if (doc) return doc
  }
  if (params.stripeCouponId) {
    const byCoupon = await payload.find({
      collection: 'discount-codes',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { stripeCouponId: { equals: params.stripeCouponId } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { id: true } as any,
    })
    const doc = byCoupon.docs[0] as { id: number } | undefined
    if (doc) return doc
  }
  return null
}

async function findDiscountDocByCode(
  payload: Payload,
  tenantId: number,
  code: string,
): Promise<{ id: number } | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const result = await payload.find({
    collection: 'discount-codes',
    where: {
      and: [{ tenant: { equals: tenantId } }, { code: { equals: normalized } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as any,
  })
  const doc = result.docs[0] as { id: number } | undefined
  return doc ?? null
}

type SyncPayloadContext = {
  tenant: number
  stripeWebhookSync: true
  skipStripeSync: true
}

/**
 * Sync a promotion code (+ coupon) from Stripe into the discount-codes collection.
 */
export async function syncStripePromotionCodeToPayload(params: {
  payload: Payload
  tenantId: number
  accountId: string
  promotionCode: StripePromotionCodeLike
  coupon: StripeCouponLike
}): Promise<void> {
  const { payload, tenantId, promotionCode, coupon } = params

  const promoId = promotionCode.id
  const couponId = typeof coupon.id === 'string' ? coupon.id : undefined
  if (!promoId || !couponId) {
    return
  }

  const code =
    typeof promotionCode.code === 'string' && promotionCode.code.trim()
      ? promotionCode.code.trim().toUpperCase()
      : null
  if (!code) {
    return
  }

  const mapped = mapStripeCouponToPayloadFields(coupon)
  const status = promotionCodeStatusFromStripe(promotionCode.active)

  const baseData: Record<string, unknown> = {
    name:
      typeof coupon.name === 'string' && coupon.name.trim()
        ? coupon.name.trim()
        : `Stripe ${code}`,
    code,
    ...mapped,
    stripeCouponId: couponId,
    stripePromotionCodeId: promoId,
    status,
  }

  const ctx: SyncPayloadContext = {
    tenant: tenantId,
    stripeWebhookSync: true,
    skipStripeSync: true,
  }

  const existing =
    (await findDiscountDocByStripeIds(payload, tenantId, {
      stripePromotionCodeId: promoId,
      stripeCouponId: couponId,
    })) ?? (await findDiscountDocByCode(payload, tenantId, code))

  if (existing) {
    await payload.update({
      collection: 'discount-codes',
      id: existing.id,
      data: baseData,
      context: ctx,
      overrideAccess: true,
    })
    return
  }

  await payload.create({
    collection: 'discount-codes',
    // Dynamic Stripe mapping; fields match DiscountCode after runtime validation above.
    data: {
      ...baseData,
      tenant: tenantId,
    } as import('@/payload-types').DiscountCode & { tenant: number },
    draft: false,
    context: ctx,
    overrideAccess: true,
  })
}

/**
 * Archive Payload discount docs when the Stripe coupon is deleted.
 */
export async function archiveDiscountByStripeCouponId(params: {
  payload: Payload
  tenantId: number
  stripeCouponId: string
}): Promise<void> {
  const { payload, tenantId, stripeCouponId } = params
  const result = await payload.find({
    collection: 'discount-codes',
    where: {
      and: [{ tenant: { equals: tenantId } }, { stripeCouponId: { equals: stripeCouponId } }],
    },
    limit: 50,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as any,
  })
  const ctx: SyncPayloadContext = {
    tenant: tenantId,
    stripeWebhookSync: true,
    skipStripeSync: true,
  }
  for (const doc of result.docs as Array<{ id: number }>) {
    await payload.update({
      collection: 'discount-codes',
      id: doc.id,
      data: { status: 'archived' },
      context: ctx,
      overrideAccess: true,
    })
  }
}

/**
 * Apply coupon field updates to existing discount-codes rows (same Stripe coupon id).
 */
export async function syncStripeCouponFieldsToExistingDocs(params: {
  payload: Payload
  tenantId: number
  coupon: StripeCouponLike
}): Promise<void> {
  const { payload, tenantId, coupon } = params
  const couponId = typeof coupon.id === 'string' ? coupon.id : null
  if (!couponId) return

  const mapped = mapStripeCouponToPayloadFields(coupon)
  const result = await payload.find({
    collection: 'discount-codes',
    where: {
      and: [{ tenant: { equals: tenantId } }, { stripeCouponId: { equals: couponId } }],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as any,
  })

  const ctx: SyncPayloadContext = {
    tenant: tenantId,
    stripeWebhookSync: true,
    skipStripeSync: true,
  }

  const name =
    typeof coupon.name === 'string' && coupon.name.trim() ? coupon.name.trim() : undefined

  const data: Record<string, unknown> = {
    ...mapped,
    ...(name != null ? { name } : {}),
  }

  for (const doc of result.docs as Array<{ id: number }>) {
    await payload.update({
      collection: 'discount-codes',
      id: doc.id,
      data,
      context: ctx,
      overrideAccess: true,
    })
  }
}

/**
 * Handle Connect webhook events for coupon / promotion_code objects.
 */
export async function syncDiscountFromWebhookEvent(params: {
  payload: Payload
  tenantId: number
  accountId: string
  eventType: string
  eventObject: Record<string, unknown>
}): Promise<void> {
  const { payload, tenantId, accountId, eventType, eventObject } = params
  const stripe = getPlatformStripe()

  if (eventType === 'promotion_code.created' || eventType === 'promotion_code.updated') {
    const id = typeof eventObject.id === 'string' ? eventObject.id : null
    if (!id) return
    const pc = await stripe.promotionCodes.retrieve(
      id,
      { expand: ['coupon'] },
      { stripeAccount: accountId },
    )
    const couponRaw = pc.coupon
    const coupon: Stripe.Coupon =
      typeof couponRaw === 'string'
        ? await stripe.coupons.retrieve(couponRaw, {}, { stripeAccount: accountId })
        : (couponRaw as Stripe.Coupon)
    await syncStripePromotionCodeToPayload({
      payload,
      tenantId,
      accountId,
      promotionCode: pc,
      coupon,
    })
    return
  }

  if (eventType === 'coupon.updated') {
    const id = typeof eventObject.id === 'string' ? eventObject.id : null
    if (!id) return
    const coupon = await stripe.coupons.retrieve(id, {}, { stripeAccount: accountId })
    await syncStripeCouponFieldsToExistingDocs({ payload, tenantId, coupon })
    return
  }

  if (eventType === 'coupon.deleted') {
    const id = typeof eventObject.id === 'string' ? eventObject.id : null
    if (!id) return
    await archiveDiscountByStripeCouponId({ payload, tenantId, stripeCouponId: id })
  }
}

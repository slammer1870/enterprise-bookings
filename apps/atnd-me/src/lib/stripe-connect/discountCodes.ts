import type { Payload } from 'payload'

export type TenantDiscountCode = {
  code: string
  type: 'percentage_off' | 'amount_off'
  value: number
  currency?: string | null
  stripePromotionCodeId?: string | null
}

export async function resolveTenantDiscountCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<TenantDiscountCode | undefined> {
  const code = discountCode.trim().toUpperCase()
  if (!code) return undefined

  const match = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { code: { equals: code } },
        { status: { equals: 'active' } },
        { stripePromotionCodeId: { exists: true } },
      ],
    },
  })

  const discountDoc = match.docs[0] as
    | {
        code?: string | null
        type?: TenantDiscountCode['type'] | null
        value?: number | null
        currency?: string | null
        stripePromotionCodeId?: string | null
      }
    | undefined

  if (!discountDoc?.type || typeof discountDoc.value !== 'number') {
    return undefined
  }

  return {
    code: String(discountDoc.code ?? code).trim().toUpperCase(),
    type: discountDoc.type,
    value: discountDoc.value,
    currency: discountDoc.currency ?? null,
    stripePromotionCodeId: discountDoc.stripePromotionCodeId ?? null,
  }
}

export async function resolveTenantPromotionCodeId(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<string | undefined> {
  const discountDoc = await resolveTenantDiscountCode(payload, tenantId, discountCode)
  return discountDoc?.stripePromotionCodeId && String(discountDoc.stripePromotionCodeId).trim()
    ? String(discountDoc.stripePromotionCodeId).trim()
    : undefined
}

export async function validateTenantDiscountCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<boolean> {
  const promotionCodeId = await resolveTenantPromotionCodeId(payload, tenantId, discountCode)
  return typeof promotionCodeId === 'string' && promotionCodeId.length > 0
}

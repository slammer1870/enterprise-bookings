import type { Payload } from 'payload'

export type TenantDiscountCode = {
  code: string
  type: 'percentage_off' | 'amount_off'
  value: number
  currency?: string | null
  stripePromotionCodeId?: string | null
}

type DiscountCodeDoc = {
  code?: string | null
  type?: TenantDiscountCode['type'] | null
  value?: number | null
  currency?: string | null
  stripePromotionCodeId?: string | null
}

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase()
}

/** Active tenant discount codes are matched case-insensitively (legacy rows may be lowercase). */
export async function findActiveTenantDiscountDocByCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<DiscountCodeDoc | undefined> {
  const normalizedCode = normalizeDiscountCode(discountCode)
  if (!normalizedCode) return undefined

  const match = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { equals: 'active' } },
        { stripePromotionCodeId: { exists: true } },
      ],
    },
  })

  return match.docs.find(
    (doc) => normalizeDiscountCode(String((doc as DiscountCodeDoc).code ?? '')) === normalizedCode,
  ) as DiscountCodeDoc | undefined
}

export async function resolveTenantDiscountCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<TenantDiscountCode | undefined> {
  const code = normalizeDiscountCode(discountCode)
  if (!code) return undefined

  const discountDoc = await findActiveTenantDiscountDocByCode(payload, tenantId, discountCode) as
    | DiscountCodeDoc
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

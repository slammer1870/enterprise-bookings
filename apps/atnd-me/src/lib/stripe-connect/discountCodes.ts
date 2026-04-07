import type { Payload } from 'payload'

export async function resolveTenantPromotionCodeId(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<string | undefined> {
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

  const discountDoc = match.docs[0] as { stripePromotionCodeId?: string | null } | undefined
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

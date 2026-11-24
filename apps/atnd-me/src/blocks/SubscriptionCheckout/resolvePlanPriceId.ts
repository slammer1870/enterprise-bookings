import type Stripe from 'stripe'

import { getPlatformStripe } from '@/lib/stripe/platform'

type PlanPriceFields = {
  priceJSON?: unknown
  stripeProductId?: unknown
}

/**
 * Resolve Stripe price id for a plan: priceJSON first, then Connect product default_price.
 * Mirrors resolveClassPassPriceId / booking-flow plan price resolution.
 */
export async function resolvePlanPriceId(
  doc: PlanPriceFields,
  stripeOpts?: Stripe.RequestOptions,
): Promise<string | null> {
  const rawPriceJsonField = doc.priceJSON
  let priceId: string | null = null

  if (typeof rawPriceJsonField === 'string' && rawPriceJsonField.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawPriceJsonField) as { id?: unknown }
      if (typeof parsed?.id === 'string' && parsed.id.trim().length > 0) {
        priceId = parsed.id.trim()
      }
    } catch {
      priceId = null
    }
  } else if (typeof rawPriceJsonField === 'object' && rawPriceJsonField !== null) {
    const obj = rawPriceJsonField as { id?: unknown }
    if (typeof obj.id === 'string' && obj.id.trim().length > 0) {
      priceId = obj.id.trim()
    }
  }

  if (priceId != null) return priceId

  const stripeProductId =
    typeof doc.stripeProductId === 'string' && doc.stripeProductId.trim()
      ? doc.stripeProductId.trim()
      : null
  if (!stripeProductId) return null

  try {
    const stripe = getPlatformStripe()
    const product = await stripe.products.retrieve(
      stripeProductId,
      { expand: ['default_price'] },
      stripeOpts,
    )
    const defaultPrice = product.default_price as { id?: string } | null | undefined
    if (typeof defaultPrice?.id === 'string' && defaultPrice.id.trim().length > 0) {
      return defaultPrice.id.trim()
    }
  } catch {
    return null
  }

  return null
}

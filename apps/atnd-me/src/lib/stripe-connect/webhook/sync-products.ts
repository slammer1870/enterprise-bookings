import type Stripe from 'stripe'
import type { Payload } from 'payload'

import { getPlatformStripe } from '@/lib/stripe/platform'

type StripeProductWithExpandedPrice = Stripe.Product & {
  default_price?: string | Stripe.Price | null
}

function normalizePriceFields(price: Stripe.Price | null): {
  priceJSON: string | null
  planPriceInformation: { price?: number; interval?: string; intervalCount?: number }
  classPassPriceInformation: { price?: number }
} {
  const unitAmount = typeof price?.unit_amount === 'number' ? price.unit_amount / 100 : undefined
  const recurring = price?.type === 'recurring' ? price.recurring : undefined

  return {
    priceJSON: price ? JSON.stringify(price) : null,
    planPriceInformation: {
      price: unitAmount,
      interval: recurring?.interval,
      intervalCount: recurring?.interval_count,
    },
    classPassPriceInformation: {
      price: unitAmount,
    },
  }
}

async function updateLinkedDocsForCollection({
  payload,
  collection,
  tenantId,
  stripeProductId,
  data,
}: {
  payload: Payload
  collection: 'plans' | 'class-pass-types'
  tenantId: number
  stripeProductId: string
  data: Record<string, unknown>
}): Promise<void> {
  const result = await payload.find({
    collection,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { stripeProductId: { equals: stripeProductId } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as any,
  })

  for (const doc of result.docs as Array<{ id: number | string }>) {
    await payload.update({
      collection,
      id: doc.id,
      data,
      context: { tenant: tenantId, skipStripeSync: true },
      overrideAccess: true,
      select: { id: true } as any,
    })
  }
}

export async function syncStripeProductToPayload({
  payload,
  tenantId,
  accountId,
  stripeProductId,
  fallbackProduct,
}: {
  payload: Payload
  tenantId: number
  accountId: string
  stripeProductId: string
  fallbackProduct?: Partial<Stripe.Product> | null
}): Promise<void> {
  const stripe = getPlatformStripe()
  let product: StripeProductWithExpandedPrice
  try {
    product = (await stripe.products.retrieve(
      stripeProductId,
      { expand: ['default_price'] },
      { stripeAccount: accountId },
    )) as StripeProductWithExpandedPrice
  } catch (error) {
    if (!fallbackProduct?.id) throw error
    product = {
      id: fallbackProduct.id,
      object: 'product',
      active: fallbackProduct.active ?? false,
      name: fallbackProduct.name ?? '',
      default_price: fallbackProduct.default_price ?? null,
    } as StripeProductWithExpandedPrice
  }

  const defaultPrice =
    typeof product.default_price === 'object' && product.default_price != null
      ? (product.default_price as Stripe.Price)
      : null

  const normalized = normalizePriceFields(defaultPrice)
  const sharedFields = {
    name: product.name,
    status: product.active ? 'active' : 'inactive',
    stripeProductId: product.id,
    priceJSON: normalized.priceJSON,
  }

  await updateLinkedDocsForCollection({
    payload,
    collection: 'plans',
    tenantId,
    stripeProductId: product.id,
    data: {
      ...sharedFields,
      priceInformation: normalized.planPriceInformation,
    },
  })

  await updateLinkedDocsForCollection({
    payload,
    collection: 'class-pass-types',
    tenantId,
    stripeProductId: product.id,
    data: {
      ...sharedFields,
      priceInformation: normalized.classPassPriceInformation,
    },
  })
}

export function getStripeProductIdFromWebhookObject(
  object: Record<string, unknown> | undefined,
): string | null {
  if (!object) return null
  if (typeof object.id === 'string' && object.object === 'product') return object.id

  const product = object.product
  if (typeof product === 'string') return product
  if (typeof product === 'object' && product !== null && 'id' in product) {
    const id = (product as { id?: unknown }).id
    return typeof id === 'string' ? id : null
  }

  return null
}

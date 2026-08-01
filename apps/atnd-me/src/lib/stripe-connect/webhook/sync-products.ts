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

async function retrieveStripeProduct({
  accountId,
  stripeProductId,
  fallbackProduct,
}: {
  accountId: string
  stripeProductId: string
  fallbackProduct?: Partial<Stripe.Product> | null
}): Promise<StripeProductWithExpandedPrice> {
  const stripe = getPlatformStripe()
  try {
    return (await stripe.products.retrieve(
      stripeProductId,
      { expand: ['default_price'] },
      { stripeAccount: accountId },
    )) as StripeProductWithExpandedPrice
  } catch (error) {
    if (!fallbackProduct?.id) throw error
    return {
      id: fallbackProduct.id,
      object: 'product',
      active: fallbackProduct.active ?? false,
      name: fallbackProduct.name ?? '',
      default_price: fallbackProduct.default_price ?? null,
    } as StripeProductWithExpandedPrice
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
  const product = await retrieveStripeProduct({
    accountId,
    stripeProductId,
    fallbackProduct,
  })

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

/**
 * Find a tenant plan by Stripe product ID, or create an inactive stub so
 * subscription upgrades can attach a plan without listing it for purchase.
 * Membership purchase UIs only show status=active plans.
 */
export async function ensureInactivePlanForStripeProduct({
  payload,
  tenantId,
  accountId,
  stripeProductId,
  fallbackProduct,
}: {
  payload: Payload
  tenantId: number
  accountId: string | null | undefined
  stripeProductId: string
  fallbackProduct?: Partial<Stripe.Product> | null
}): Promise<{ id: number; created: boolean } | null> {
  const existing = await payload.find({
    collection: 'plans',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { stripeProductId: { equals: stripeProductId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as any,
  })
  const found = existing.docs[0] as { id: number } | undefined
  if (found) return { id: found.id, created: false }

  let name = `Imported plan (${stripeProductId})`
  let priceJSON: string | null = null
  let priceInformation: { price?: number; interval?: string; intervalCount?: number } = {}

  if (accountId) {
    try {
      const product = await retrieveStripeProduct({
        accountId,
        stripeProductId,
        fallbackProduct,
      })
      if (typeof product.name === 'string' && product.name.trim()) {
        name = product.name.trim()
      }
      const defaultPrice =
        typeof product.default_price === 'object' && product.default_price != null
          ? (product.default_price as Stripe.Price)
          : null
      const normalized = normalizePriceFields(defaultPrice)
      priceJSON = normalized.priceJSON
      priceInformation = normalized.planPriceInformation
    } catch (error) {
      payload.logger?.warn?.(
        `ensureInactivePlanForStripeProduct: could not load Stripe product ${stripeProductId}; creating inactive stub: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  const created = await payload.create({
    collection: 'plans',
    data: {
      name,
      status: 'inactive',
      tenant: tenantId,
      stripeProductId,
      skipSync: true,
      ...(priceJSON ? { priceJSON } : {}),
      ...(priceInformation.price != null ? { priceInformation } : {}),
    } as Record<string, unknown>,
    context: { tenant: tenantId, skipStripeSync: true },
    overrideAccess: true,
  })

  payload.logger?.info?.(
    `ensureInactivePlanForStripeProduct: created inactive plan ${created.id} for product ${stripeProductId} (tenant=${tenantId})`,
  )

  return { id: created.id as number, created: true }
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

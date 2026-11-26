/**
 * Protect Connect membership platform fees from tenant Dashboard edits.
 *
 * Standard connected accounts can remove a recurring "Platform fee" / "Booking fee"
 * subscription item. We (1) re-assert application_fee_amount on draft invoices and
 * (2) heal missing fee line items + application_fee_percent on subscription.updated.
 */
import type Stripe from 'stripe'

export const PLATFORM_FEE_PRODUCT_NAMES = new Set(['Platform fee', 'Booking fee'])

export function isPlatformFeeProductName(name: string | null | undefined): boolean {
  if (!name) return false
  return PLATFORM_FEE_PRODUCT_NAMES.has(name.trim())
}

export function isStripePlatformFeeSubscriptionItem(
  item: Pick<Stripe.SubscriptionItem, 'price'> | { price?: Stripe.Price | string | null },
): boolean {
  const price = item.price
  if (!price || typeof price === 'string') return false
  const product = price.product
  if (product && typeof product === 'object' && !('deleted' in product && product.deleted)) {
    return isPlatformFeeProductName((product as Stripe.Product).name)
  }
  return false
}

/** Exact application_fee_percent (2dp) that yields feeCents of totalCents. */
export function findExactApplicationFeePercent(params: {
  feeCents: number
  totalCents: number
}): number | null {
  const { feeCents, totalCents } = params
  if (!Number.isFinite(feeCents) || !Number.isFinite(totalCents)) return null
  if (feeCents <= 0 || totalCents <= 0) return null

  const twoTotal = 2 * totalCents
  const bpMin = Math.ceil(((2 * feeCents - 1) * 10000) / twoTotal)
  const bpMax = Math.floor(((2 * feeCents + 1) * 10000 - 1) / twoTotal)
  if (bpMin > bpMax) return null

  const rounded = Math.round((feeCents / totalCents) * 10000)
  const candidate = Math.min(bpMax, Math.max(bpMin, rounded))
  const computed = Math.round((totalCents * candidate) / 10000)
  if (computed !== feeCents) return null
  return candidate / 100
}

export function parsePositiveCents(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function bookingFeeCentsFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): number | null {
  return parsePositiveCents(metadata?.bookingFeeAmount)
}

export function classPriceCentsFromMetadata(
  metadata: Stripe.Metadata | null | undefined,
): number | null {
  return (
    parsePositiveCents(metadata?.classPriceAmount) ??
    parsePositiveCents(metadata?.planPriceAmount)
  )
}

export function resolveApplicationFeePercent(params: {
  feeCents: number
  totalCents: number
}): number | null {
  const exact = findExactApplicationFeePercent(params)
  if (exact != null && exact > 0) return exact
  const { feeCents, totalCents } = params
  if (feeCents <= 0 || totalCents <= 0) return null
  const fallback = Math.round((feeCents / totalCents) * 10000) / 100
  return fallback > 0 ? fallback : null
}

type InvoiceLike = {
  id: string
  status?: string | null
  application_fee_amount?: number | null
  amount_due?: number | null
  total?: number | null
  currency?: string | null
  metadata?: Stripe.Metadata | null
  parent?: {
    subscription_details?: {
      metadata?: Stripe.Metadata | null
    } | null
  } | null
  subscription_details?: {
    metadata?: Stripe.Metadata | null
  } | null
  lines?: {
    data?: Array<{
      amount?: number | null
      description?: string | null
      price?: { product?: string | Stripe.Product | null } | null
    }>
  } | null
}

/**
 * On invoice.created (draft), force application_fee_amount to the platform booking fee
 * from subscription metadata so tenants cannot zero out the platform take.
 */
export async function enforceApplicationFeeAmountOnInvoice(params: {
  stripeAccount: string | undefined
  stripe: {
    invoices: {
      update: (
        id: string,
        data: { application_fee_amount: number },
        options?: { stripeAccount?: string },
      ) => Promise<unknown>
    }
  }
  invoice: InvoiceLike
}): Promise<'updated' | 'skipped'> {
  const { invoice, stripe, stripeAccount } = params
  if (invoice.status && invoice.status !== 'draft') return 'skipped'

  const meta =
    invoice.parent?.subscription_details?.metadata ??
    invoice.subscription_details?.metadata ??
    invoice.metadata ??
    null
  const feeCents = bookingFeeCentsFromMetadata(meta)
  if (feeCents == null) return 'skipped'

  const invoiceTotal =
    typeof invoice.amount_due === 'number' && invoice.amount_due > 0
      ? invoice.amount_due
      : typeof invoice.total === 'number' && invoice.total > 0
        ? invoice.total
        : null
  if (invoiceTotal == null) return 'skipped'

  // Never take more than the invoice total (Stripe rejects that).
  const applicationFeeAmount = Math.min(feeCents, invoiceTotal)
  if (applicationFeeAmount <= 0) return 'skipped'

  if (invoice.application_fee_amount === applicationFeeAmount) return 'skipped'

  await stripe.invoices.update(
    invoice.id,
    { application_fee_amount: applicationFeeAmount },
    stripeAccount ? { stripeAccount } : undefined,
  )
  return 'updated'
}

type HealStripe = {
  prices: {
    create: (
      params: Stripe.PriceCreateParams,
      options?: { stripeAccount?: string },
    ) => Promise<Stripe.Price>
  }
  subscriptions: {
    update: (
      id: string,
      params: Stripe.SubscriptionUpdateParams,
      options?: { stripeAccount?: string },
    ) => Promise<Stripe.Subscription>
  }
}

/**
 * If a Connect membership still has bookingFeeAmount in metadata but the recurring
 * Platform/Booking fee item was removed (or application_fee_percent cleared), restore both.
 */
export async function healSubscriptionPlatformFee(params: {
  stripeAccount: string | undefined
  stripe: HealStripe
  subscription: Stripe.Subscription
}): Promise<'updated' | 'skipped'> {
  const { subscription, stripe, stripeAccount } = params
  const meta = subscription.metadata
  const feeCents = bookingFeeCentsFromMetadata(meta)
  if (feeCents == null) return 'skipped'

  const items = subscription.items?.data ?? []
  if (items.length === 0) return 'skipped'

  const feeItems = items.filter(isStripePlatformFeeSubscriptionItem)
  const planItem =
    items.find((item) => !isStripePlatformFeeSubscriptionItem(item)) ?? items[0] ?? null
  if (!planItem) return 'skipped'

  const planPrice = planItem.price
  const recurring =
    planPrice && typeof planPrice !== 'string' ? planPrice.recurring : null
  const currency =
    planPrice && typeof planPrice !== 'string'
      ? (planPrice.currency || 'eur').toLowerCase()
      : 'eur'

  const classPriceCents =
    classPriceCentsFromMetadata(meta) ??
    (planPrice && typeof planPrice !== 'string' && typeof planPrice.unit_amount === 'number'
      ? planPrice.unit_amount
      : null)
  const totalCents =
    classPriceCents != null && classPriceCents > 0 ? classPriceCents + feeCents : feeCents
  const desiredPct = resolveApplicationFeePercent({ feeCents, totalCents })
  const currentPct =
    typeof subscription.application_fee_percent === 'number'
      ? subscription.application_fee_percent
      : null

  const needsFeeItem = feeItems.length === 0
  const needsPct =
    desiredPct != null &&
    (currentPct == null || Math.abs(currentPct - desiredPct) > 0.001)

  if (!needsFeeItem && !needsPct) return 'skipped'

  const stripeOpts = stripeAccount ? { stripeAccount } : undefined
  const itemUpdates: Stripe.SubscriptionUpdateParams.Item[] = []

  if (needsFeeItem) {
    if (!recurring) return 'skipped'
    const feePrice = await stripe.prices.create(
      {
        currency,
        unit_amount: feeCents,
        recurring: {
          interval: recurring.interval,
          interval_count: recurring.interval_count ?? 1,
        },
        product_data: {
          name: 'Platform fee',
        },
      },
      stripeOpts,
    )
    itemUpdates.push({ price: feePrice.id, quantity: 1 })
  }

  await stripe.subscriptions.update(
    subscription.id,
    {
      ...(itemUpdates.length > 0
        ? {
            items: itemUpdates,
            proration_behavior: 'none',
          }
        : {}),
      ...(needsPct && desiredPct != null ? { application_fee_percent: desiredPct } : {}),
      metadata: {
        ...(meta ?? {}),
        bookingFeeAmount: String(feeCents),
        ...(classPriceCents != null ? { classPriceAmount: String(classPriceCents) } : {}),
      },
    },
    stripeOpts,
  )
  return 'updated'
}

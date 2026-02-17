/**
 * Phase 4.5 – Create/update/archive Stripe products and prices on tenant Connect account.
 * All operations use stripeAccount so products live on the tenant's Connect account.
 */
import type Stripe from 'stripe'
import { getPlatformStripe } from '@/lib/stripe/platform'
import {
  requireTenantConnectAccount,
  getTenantStripeContext,
  type TenantStripeLike,
} from '@/lib/stripe-connect/tenantStripe'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'

export type RecurringPriceData = {
  unit_amount: number // cents
  currency: string
  interval: 'day' | 'week' | 'month' | 'year'
  interval_count?: number
}

export type OneTimePriceData = {
  unit_amount: number // cents
  currency: string
}

export type CreateTenantProductParams = {
  tenant: TenantStripeLike & { id?: number }
  name: string
  description?: string
  metadata?: Record<string, string>
} & (
  | { defaultPriceData: { recurring: RecurringPriceData } }
  | { defaultPriceData: { oneTime: OneTimePriceData } }
)

export type CreateTenantProductResult = {
  productId: string
  priceId: string
}

/**
 * Create a Stripe Product with a default price on the tenant's Connect account.
 * Use for plans (recurring) or class pass types (one-time).
 */
export async function createTenantProduct(
  params: CreateTenantProductParams,
): Promise<CreateTenantProductResult> {
  const { tenant, name, description, metadata, defaultPriceData } = params
  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) throw new Error('Tenant Connect account id is missing')

  const isE2e =
    process.env.ENABLE_TEST_WEBHOOKS === 'true' || process.env.NODE_ENV === 'test'
  if (isStripeTestAccount(accountId) || (isE2e && /^acct_[a-z_]+_\d+$/.test(accountId))) {
    const suffix = Date.now()
    return { productId: `prod_test_${suffix}`, priceId: `price_test_${suffix}` }
  }

  const stripe = getPlatformStripe()
  const isRecurring = 'recurring' in defaultPriceData
  const priceData: Stripe.ProductCreateParams.DefaultPriceData = isRecurring
    ? {
        currency: defaultPriceData.recurring.currency,
        unit_amount: defaultPriceData.recurring.unit_amount,
        recurring: {
          interval: defaultPriceData.recurring.interval,
          ...(defaultPriceData.recurring.interval_count != null && {
            interval_count: defaultPriceData.recurring.interval_count,
          }),
        },
      }
    : {
        currency: defaultPriceData.oneTime.currency,
        unit_amount: defaultPriceData.oneTime.unit_amount,
      }

  const product = await stripe.products.create(
    {
      name,
      ...(description != null && { description }),
      ...(metadata != null && { metadata }),
      default_price_data: priceData,
    },
    { stripeAccount: accountId },
  )

  const priceId =
    typeof product.default_price === 'object' && product.default_price != null
      ? product.default_price.id
      : typeof product.default_price === 'string'
        ? product.default_price
        : null
  if (!priceId) throw new Error('Stripe product created but has no default price')

  return { productId: product.id, priceId }
}

export type UpdateTenantProductParams = {
  tenant: TenantStripeLike & { id?: number }
  productId: string
  name?: string
  description?: string
  active?: boolean
}

/**
 * Update a Stripe Product on the tenant's Connect account (name, description, active).
 */
export async function updateTenantProduct(
  params: UpdateTenantProductParams,
): Promise<void> {
  const { tenant, productId, name, description, active } = params
  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) throw new Error('Tenant Connect account id is missing')

  const isE2e =
    process.env.ENABLE_TEST_WEBHOOKS === 'true' || process.env.NODE_ENV === 'test'
  if (isStripeTestAccount(accountId) || (isE2e && /^acct_[a-z_]+_\d+$/.test(accountId))) {
    return
  }

  const stripe = getPlatformStripe()
  await stripe.products.update(
    productId,
    {
      ...(name != null && { name }),
      ...(description !== undefined && { description }),
      ...(active !== undefined && { active }),
    },
    { stripeAccount: accountId },
  )
}

/**
 * Archive a Stripe Product on the tenant's Connect account (active: false).
 */
export async function archiveTenantProduct(
  tenant: TenantStripeLike & { id?: number },
  productId: string,
): Promise<void> {
  await updateTenantProduct({ tenant, productId, active: false })
}

export type CreateTenantPriceParams = {
  tenant: TenantStripeLike & { id?: number }
  productId: string
  unit_amount: number // cents
  currency: string
  recurring?: { interval: 'day' | 'week' | 'month' | 'year'; interval_count?: number }
}

export type CreateTenantPriceResult = { priceId: string }

/**
 * Create a new Price on the tenant's Connect account and optionally set as product default.
 */
export async function createTenantPrice(
  params: CreateTenantPriceParams,
): Promise<CreateTenantPriceResult> {
  const { tenant, productId, unit_amount, currency, recurring } = params
  requireTenantConnectAccount(tenant)
  const { accountId } = getTenantStripeContext(tenant)
  if (!accountId) throw new Error('Tenant Connect account id is missing')

  const isE2e =
    process.env.ENABLE_TEST_WEBHOOKS === 'true' || process.env.NODE_ENV === 'test'
  if (isStripeTestAccount(accountId) || (isE2e && /^acct_[a-z_]+_\d+$/.test(accountId))) {
    return { priceId: `price_test_${Date.now()}` }
  }

  const stripe = getPlatformStripe()
  const priceParams: Stripe.PriceCreateParams = {
    product: productId,
    currency,
    unit_amount,
    ...(recurring != null
      ? { recurring: { interval: recurring.interval, ...(recurring.interval_count != null && { interval_count: recurring.interval_count }) } }
      : {}),
  }
  const price = await stripe.prices.create(priceParams, { stripeAccount: accountId })

  if (recurring != null) {
    await stripe.products.update(
      productId,
      { default_price: price.id },
      { stripeAccount: accountId },
    )
  }

  return { priceId: price.id }
}

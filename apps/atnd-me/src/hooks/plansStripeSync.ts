/**
 * Phase 4.5 – Sync plans to tenant Stripe Connect: create product on create, update/archive on update/delete.
 */
import type { CollectionAfterChangeHook, CollectionBeforeDeleteHook } from 'payload'
import { createTenantProduct, updateTenantProduct, archiveTenantProduct, createTenantPrice } from '@/lib/stripe-connect/products'
import type { TenantStripeLike } from '@/lib/stripe-connect/tenantStripe'
import { getTenantStripeContext } from '@/lib/stripe-connect/tenantStripe'

async function getTenantForPlan(payload: import('payload').Payload, tenantId: number) {
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  return tenant as (TenantStripeLike & { id: number }) | null
}

async function getStoredStripeProductId(
  payload: import('payload').Payload,
  id: number,
): Promise<string | undefined> {
  const stored = await payload.findByID({
    collection: 'plans',
    id,
    depth: 0,
    overrideAccess: true,
  })
  return (stored as unknown as Record<string, unknown>)?.stripeProductId as string | undefined
}

function getTenantId(doc: Record<string, unknown>): number | null {
  const t = doc.tenant
  if (t == null) return null
  if (typeof t === 'number') return t
  if (typeof t === 'object' && t !== null && 'id' in t) return (t as { id: number }).id
  return null
}

/** Create Stripe product + recurring price on Connect when plan is created (no stripeProductId). */
export const planAfterChangeSyncToStripe: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
  previousDoc,
}) => {
  if (req.context?.skipStripeSync) return

  const tenantId = getTenantId(doc as unknown as Record<string, unknown>)
  if (tenantId == null) return

  const tenant = await getTenantForPlan(req.payload, tenantId)
  if (!tenant) return
  const tenantLike = tenant as TenantStripeLike & { id?: number }
  const ctx = getTenantStripeContext(tenantLike)
  if (!ctx.isConnected) return

  const data = doc as Record<string, unknown>
  const skipSync = data.skipSync === true
  const stripeProductId =
    operation === 'update'
      ? ((data.stripeProductId as string | undefined) ??
        (typeof doc.id === 'number' ? await getStoredStripeProductId(req.payload, doc.id) : undefined))
      : (data.stripeProductId as string | undefined)

  if (operation === 'create') {
    if (skipSync || stripeProductId) return
    const priceInfo = data.priceInformation as { price?: number; intervalCount?: number; interval?: string } | undefined
    if (priceInfo?.price == null) return
    const priceCents = Math.round((priceInfo.price ?? 0) * 100)
    const interval = (priceInfo?.interval as 'day' | 'week' | 'month' | 'year') ?? 'month'
    const intervalCount = priceInfo?.intervalCount ?? 1
    const { productId, priceId } = await createTenantProduct({
      tenant: tenantLike,
      name: String(data.name ?? 'Plan'),
      defaultPriceData: {
        recurring: {
          unit_amount: priceCents,
          currency: 'eur',
          interval,
          interval_count: intervalCount,
        },
      },
    })
    await req.payload.update({
      collection: 'plans',
      id: doc.id,
      data: {
        stripeProductId: productId,
        priceJSON: JSON.stringify({ id: priceId }),
      },
      context: { ...req.context, skipStripeSync: true },
      req,
    })
    return
  }

  if (operation === 'update' && stripeProductId) {
    if (data.name !== (previousDoc as unknown as Record<string, unknown>)?.name) {
      await updateTenantProduct({ tenant: tenantLike, productId: stripeProductId, name: String(data.name) })
    }
    const prevPrice = (previousDoc as unknown as Record<string, unknown>)?.priceInformation as { price?: number; interval?: string; intervalCount?: number } | undefined
    const currPrice = data.priceInformation as { price?: number; interval?: string; intervalCount?: number } | undefined
    const priceChanged =
      currPrice?.price !== prevPrice?.price ||
      currPrice?.interval !== prevPrice?.interval ||
      currPrice?.intervalCount !== prevPrice?.intervalCount
    if (priceChanged && currPrice?.price != null) {
      const priceCents = Math.round((currPrice.price ?? 0) * 100)
      const interval = (currPrice.interval as 'day' | 'week' | 'month' | 'year') ?? 'month'
      const intervalCount = currPrice.intervalCount ?? 1
      await createTenantPrice({
        tenant: tenantLike,
        productId: stripeProductId,
        unit_amount: priceCents,
        currency: 'eur',
        recurring: { interval, interval_count: intervalCount },
      })
    }
  }
}

/** Soft delete: set deletedAt and archive product in Stripe, then abort the delete so doc remains. */
export const planBeforeDeleteArchive: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({ collection: 'plans', id, depth: 0 })
  if (!doc) return
  const tenantId = getTenantId(doc as unknown as Record<string, unknown>)
  const stripeProductId = (doc as unknown as Record<string, unknown>).stripeProductId as string | undefined
  if (tenantId == null || !stripeProductId) return
  const tenant = await getTenantForPlan(req.payload, tenantId)
  if (!tenant) return
  const tenantLike = tenant as TenantStripeLike & { id?: number }
  const ctx = getTenantStripeContext(tenantLike)
  if (!ctx.isConnected) return

  await req.payload.update({
    collection: 'plans',
    id,
    data: { deletedAt: new Date().toISOString() },
    context: { skipStripeSync: true },
    req,
  })
  await archiveTenantProduct(tenantLike, stripeProductId)
  throw new Error('Plan was archived instead of deleted. Refresh the list.')
}

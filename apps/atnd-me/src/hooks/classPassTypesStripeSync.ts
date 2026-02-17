/**
 * Phase 4.5 – Sync class-pass-types to tenant Stripe Connect: create product on create, archive on delete.
 */
import type { CollectionAfterChangeHook, CollectionBeforeDeleteHook } from 'payload'
import {
  createTenantProduct,
  updateTenantProduct,
  archiveTenantProduct,
  createTenantPrice,
} from '@/lib/stripe-connect/products'
import { getTenantStripeContext } from '@/lib/stripe-connect/tenantStripe'

async function getTenantForDoc(payload: import('payload').Payload, tenantId: number) {
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  return tenant as { id: number; stripeConnectAccountId?: string | null; stripeConnectOnboardingStatus?: string | null } | null
}

function getTenantId(doc: Record<string, unknown>): number | null {
  const t = doc.tenant
  if (t == null) return null
  if (typeof t === 'number') return t
  if (typeof t === 'object' && t !== null && 'id' in t) return (t as { id: number }).id
  return null
}

/** Create Stripe product + one-time price on Connect when class-pass-type is created (no stripeProductId). */
export const classPassTypeAfterChangeSyncToStripe: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
  previousDoc,
}) => {
  if (req.context?.skipStripeSync) return

  const tenantId = getTenantId(doc as Record<string, unknown>)
  if (tenantId == null) return

  const tenant = await getTenantForDoc(req.payload, tenantId)
  if (!tenant) return
  const ctx = getTenantStripeContext(tenant)
  if (!ctx.isConnected) return

  const data = doc as Record<string, unknown>
  if (data.skipSync === true || data.stripeProductId) return

  if (operation === 'create') {
    const priceInfo = data.priceInformation as { price?: number } | undefined
    const priceCents = priceInfo?.price != null ? Math.round(priceInfo.price * 100) : 0
    const { productId, priceId } = await createTenantProduct({
      tenant,
      name: String(data.name ?? 'Class Pass'),
      defaultPriceData: {
        oneTime: { unit_amount: priceCents, currency: 'eur' },
      },
    })
    await req.payload.update({
      collection: 'class-pass-types',
      id: doc.id,
      data: {
        stripeProductId: productId,
        priceJSON: JSON.stringify({ id: priceId }),
        skipSync: true,
      },
      context: { ...req.context, skipStripeSync: true },
      req,
    })
    return
  }

  if (operation === 'update' && stripeProductId) {
    if (data.name !== (previousDoc as Record<string, unknown>)?.name) {
      await updateTenantProduct({ tenant, productId: stripeProductId, name: String(data.name) })
    }
    const prevPrice = (previousDoc as Record<string, unknown>)?.priceInformation as { price?: number } | undefined
    const currPrice = data.priceInformation as { price?: number } | undefined
    const priceChanged = currPrice?.price !== prevPrice?.price
    if (priceChanged && currPrice?.price != null) {
      const priceCents = Math.round(currPrice.price * 100)
      await createTenantPrice({
        tenant,
        productId: stripeProductId,
        unit_amount: priceCents,
        currency: 'eur',
      })
    }
  }
}

/** Soft delete: set deletedAt and archive product in Stripe, then abort the delete. */
export const classPassTypeBeforeDeleteArchive: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({ collection: 'class-pass-types', id, depth: 0 })
  if (!doc) return
  const tenantId = getTenantId(doc as Record<string, unknown>)
  const stripeProductId = (doc as Record<string, unknown>).stripeProductId as string | undefined
  if (tenantId == null || !stripeProductId) return
  const tenant = await getTenantForDoc(req.payload, tenantId)
  if (!tenant) return
  const ctx = getTenantStripeContext(tenant)
  if (!ctx.isConnected) return

  await req.payload.update({
    collection: 'class-pass-types',
    id,
    data: { deletedAt: new Date().toISOString(), skipSync: true },
    context: { skipStripeSync: true },
    req,
  })
  await archiveTenantProduct(tenant, stripeProductId)
  throw new Error('Class pass type was archived instead of deleted. Refresh the list.')
}

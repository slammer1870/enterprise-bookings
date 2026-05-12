/**
 * Require an active Stripe Connect account before saving priced plans / class-pass-types
 * (unless skipSync or hook context skipStripeSync is set — imports and internal updates).
 */
import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

import { getTenantStripeContext, type TenantStripeLike } from '@/lib/stripe-connect/tenantStripe'

function resolveTenantId(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | null | undefined,
): number | null {
  const raw = data.tenant !== undefined ? data.tenant : originalDoc?.tenant
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && raw !== null && 'id' in raw) return (raw as { id: number }).id
  return null
}

type PlanPriceInformation = { price?: number; interval?: string; intervalCount?: number }

function mergePlanPriceInformation(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | null | undefined,
): PlanPriceInformation | undefined {
  const incoming = data.priceInformation as PlanPriceInformation | undefined
  const previous = originalDoc?.priceInformation as PlanPriceInformation | undefined
  if (data.priceInformation !== undefined) {
    return { ...previous, ...incoming }
  }
  return previous
}

function mergeClassPassPriceInformation(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | null | undefined,
): { price?: number } | undefined {
  const incoming = data.priceInformation as { price?: number } | undefined
  const previous = originalDoc?.priceInformation as { price?: number } | undefined
  if (data.priceInformation !== undefined) {
    return { ...previous, ...incoming }
  }
  return previous
}

function planPriceInformationUnchanged(
  merged: PlanPriceInformation | undefined,
  previous: PlanPriceInformation | undefined,
): boolean {
  return (
    merged?.price === previous?.price &&
    merged?.interval === previous?.interval &&
    merged?.intervalCount === previous?.intervalCount
  )
}

function classPassPriceUnchanged(
  merged: { price?: number } | undefined,
  previous: { price?: number } | undefined,
): boolean {
  return merged?.price === previous?.price
}

async function assertTenantConnectedForPricedSave(args: {
  payload: import('payload').Payload
  tenantId: number
  label: 'membership plan' | 'class pass type'
}): Promise<void> {
  const { payload, tenantId, label } = args
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  if (!tenant) {
    throw new APIError(`Tenant ${tenantId} was not found.`, 400)
  }
  const ctx = getTenantStripeContext(tenant as TenantStripeLike)
  if (ctx.isConnected) return

  const hint = ctx.requiresOnboarding
    ? 'Stripe Connect onboarding is not complete for this tenant.'
    : 'This tenant is not connected to Stripe Connect.'
  throw new APIError(
    `${hint} Complete Stripe Connect (active account) before saving a priced ${label}, or enable "Skip Stripe sync" on this document for imports.`,
    400,
  )
}

export const planBeforeValidateStripeConnect: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || typeof data !== 'object') return data
  if ((req.context as { skipStripeSync?: boolean } | undefined)?.skipStripeSync) return data
  if ((data as { skipSync?: boolean }).skipSync === true) return data

  const d = data as Record<string, unknown>
  const tenantId = resolveTenantId(d, originalDoc as Record<string, unknown> | undefined)
  if (tenantId == null) return data

  const prev = originalDoc as Record<string, unknown> | undefined
  const mergedPrice = mergePlanPriceInformation(d, prev)
  const priced = mergedPrice != null && typeof mergedPrice.price === 'number' && !Number.isNaN(mergedPrice.price)

  if (operation === 'create') {
    if (!priced) return data
    await assertTenantConnectedForPricedSave({ payload: req.payload, tenantId, label: 'membership plan' })
    return data
  }

  if (operation === 'update' && Object.prototype.hasOwnProperty.call(d, 'priceInformation')) {
    if (!priced) return data
    const previousPrice = prev?.priceInformation as PlanPriceInformation | undefined
    if (planPriceInformationUnchanged(mergedPrice, previousPrice)) return data
    await assertTenantConnectedForPricedSave({ payload: req.payload, tenantId, label: 'membership plan' })
  }

  return data
}

export const classPassTypeBeforeValidateStripeConnect: CollectionBeforeValidateHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || typeof data !== 'object') return data
  if ((req.context as { skipStripeSync?: boolean } | undefined)?.skipStripeSync) return data
  if ((data as { skipSync?: boolean }).skipSync === true) return data

  const d = data as Record<string, unknown>
  const tenantId = resolveTenantId(d, originalDoc as Record<string, unknown> | undefined)
  if (tenantId == null) return data

  const prev = originalDoc as Record<string, unknown> | undefined
  const mergedPrice = mergeClassPassPriceInformation(d, prev)
  const priced = mergedPrice != null && typeof mergedPrice.price === 'number' && !Number.isNaN(mergedPrice.price)

  if (operation === 'create') {
    if (!priced) return data
    await assertTenantConnectedForPricedSave({ payload: req.payload, tenantId, label: 'class pass type' })
    return data
  }

  if (operation === 'update' && Object.prototype.hasOwnProperty.call(d, 'priceInformation')) {
    if (!priced) return data
    const previousPrice = prev?.priceInformation as { price?: number } | undefined
    if (classPassPriceUnchanged(mergedPrice, previousPrice)) return data
    await assertTenantConnectedForPricedSave({ payload: req.payload, tenantId, label: 'class pass type' })
  }

  return data
}

import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Step 2.6.1 – Server enforcement: payment methods require Stripe Connect.
 * Rejects updates that set Stripe-backed payment methods (allowedDropIn, allowedPlans, allowedClassPasses)
 * when the class-option's tenant has stripeConnectOnboardingStatus !== 'active'.
 */
function hasAnyPaymentMethod(pm: Record<string, unknown> | null | undefined): boolean {
  if (!pm || typeof pm !== 'object') return false
  const allowedDropIn = pm.allowedDropIn
  const hasDropIn =
    allowedDropIn != null &&
    (typeof allowedDropIn === 'number' ||
      (typeof allowedDropIn === 'string' && allowedDropIn !== '') ||
      (typeof allowedDropIn === 'object' && allowedDropIn !== null))
  const allowedPlans = pm.allowedPlans
  const hasPlans = Array.isArray(allowedPlans) && allowedPlans.length > 0
  const allowedClassPasses = pm.allowedClassPasses
  const hasClassPasses = Array.isArray(allowedClassPasses) && allowedClassPasses.length > 0
  return hasDropIn || hasPlans || hasClassPasses
}

/**
 * Extracts a tenant ID from a raw field value which may be a number, string, or
 * populated relationship object. The Payload admin can submit string IDs when the
 * tenant selector initialises from a cookie before the options list has loaded.
 */
function extractTenantId(value: unknown): number | string | null {
  if (value == null) return null
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value !== '') return value
  if (typeof value === 'object' && 'id' in (value as object)) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number') return id
    if (typeof id === 'string' && id !== '') return id
  }
  return null
}

export const requireStripeConnectForPayments: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const enablingPayments =
    data?.paymentMethods &&
    typeof data.paymentMethods === 'object' &&
    hasAnyPaymentMethod(data.paymentMethods as Record<string, unknown>)

  if (!enablingPayments) return data

  const tenantId =
    extractTenantId(data?.tenant) ??
    (operation === 'update' && originalDoc ? extractTenantId(originalDoc.tenant) : null)

  if (tenantId == null) {
    throw new Error('Tenant context required to enable payments')
  }

  const tenant = await req.payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: {
      stripeConnectOnboardingStatus: true,
      stripeConnectAccountId: true,
    } as any,
  })

  const status = tenant?.stripeConnectOnboardingStatus as string | undefined
  if (status !== 'active') {
    throw new Error('Connect Stripe to enable payments for this tenant')
  }

  return data
}

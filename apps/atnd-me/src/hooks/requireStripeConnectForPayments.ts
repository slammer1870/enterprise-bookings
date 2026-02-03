import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Step 2.6.1 – Server enforcement: payment methods require Stripe Connect.
 * Rejects updates that set any payment method (allowedDropIn, allowedPlans, allowedClassPasses)
 * when the class-option's tenant has stripeConnectOnboardingStatus !== 'active'.
 */
function hasAnyPaymentMethod(pm: Record<string, unknown> | null | undefined): boolean {
  if (!pm || typeof pm !== 'object') return false
  const allowedDropIn = pm.allowedDropIn
  const hasDropIn = allowedDropIn != null && (typeof allowedDropIn === 'number' || (typeof allowedDropIn === 'object' && allowedDropIn !== null))
  const allowedPlans = pm.allowedPlans
  const hasPlans = Array.isArray(allowedPlans) && allowedPlans.length > 0
  const allowedClassPasses = pm.allowedClassPasses
  const hasClassPasses = Array.isArray(allowedClassPasses) && allowedClassPasses.length > 0
  return hasDropIn || hasPlans || hasClassPasses
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
    (typeof data?.tenant === 'object' && data?.tenant != null && 'id' in data.tenant
      ? (data.tenant as { id: number }).id
      : typeof data?.tenant === 'number'
        ? data.tenant
        : null) ??
    (operation === 'update' && originalDoc
      ? typeof originalDoc.tenant === 'object' && originalDoc.tenant != null && 'id' in originalDoc.tenant
        ? (originalDoc.tenant as { id: number }).id
        : typeof originalDoc.tenant === 'number'
          ? originalDoc.tenant
          : null
      : null)

  if (tenantId == null) {
    throw new Error('Tenant context required to enable payments')
  }

  const tenant = await req.payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })

  const status = tenant?.stripeConnectOnboardingStatus as string | undefined
  if (status !== 'active') {
    throw new Error('Connect Stripe to enable payments for this tenant')
  }

  return data
}

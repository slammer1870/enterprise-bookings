/**
 * Phase 4.5 – Resolve tenant Stripe Connect account ID for proxy requests (plans, class-pass-products).
 * Used by getStripeAccountIdForRequest in bookingsPaymentsPlugin membership/classPass config.
 */
import type { PayloadRequest } from 'payload'

function getTenantIdFromRequest(req: PayloadRequest): number | null {
  const ctx = req?.context as { tenant?: unknown } | undefined
  const raw = ctx?.tenant
  if (raw != null) {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'object' && raw !== null && 'id' in raw) {
      const id = (raw as { id: unknown }).id
      if (typeof id === 'number' && Number.isFinite(id)) return id
      if (typeof id === 'string') {
        const n = parseInt(id, 10)
        return Number.isFinite(n) ? n : null
      }
    }
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10)
      return Number.isFinite(n) ? n : null
    }
  }
  // Payload/Next may attach cookies to the request
  const cookieStore = (req as PayloadRequest & { cookies?: { get: (name: string) => { value?: string } | undefined } }).cookies
  const payloadTenant = cookieStore?.get?.('payload-tenant')?.value
  if (payloadTenant && /^\d+$/.test(payloadTenant)) return parseInt(payloadTenant, 10)
  return null
}

/**
 * Returns the Stripe Connect account ID for the tenant resolved from the request (context or payload-tenant cookie).
 * Returns null if no tenant, tenant not found, or tenant has no Connect account / not active.
 */
export async function getStripeAccountIdForRequest(req: PayloadRequest): Promise<string | null> {
  const tenantId = getTenantIdFromRequest(req)
  if (tenantId == null) return null
  const tenant = await req.payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)
  if (!tenant) return null
  const t = tenant as { stripeConnectAccountId?: string | null; stripeConnectOnboardingStatus?: string | null }
  if (!t.stripeConnectAccountId?.trim() || t.stripeConnectOnboardingStatus !== 'active') return null
  return t.stripeConnectAccountId
}

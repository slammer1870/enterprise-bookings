/**
 * Phase 4.5 – Resolve tenant Stripe Connect account ID for proxy requests (plans, class-pass-products).
 * Used by getStripeAccountIdForRequest in bookingsPaymentsPlugin membership/classPass config.
 * Returns null for E2E/test account IDs so proxy lists platform products instead of calling Stripe with a fake account.
 */
import type { PayloadRequest } from 'payload'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { getPayloadTenantIdFromRequest, getTenantSlugFromRequest } from '@/utilities/tenantRequest'

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

  const cookieStore = (req as PayloadRequest & { cookies?: { get: (name: string) => { value?: string } | undefined } }).cookies
  const tenantSlug = getTenantSlugFromRequest({ cookies: cookieStore })
  if (tenantSlug && /^[a-z0-9-]+$/i.test(tenantSlug)) {
    const cachedId = (req.context as Record<string, unknown> | undefined)?.__stripeTenantIdFromSlug
    if (typeof cachedId === 'number' && Number.isFinite(cachedId)) return cachedId
    return null
  }

  const payloadTenant = getPayloadTenantIdFromRequest({ cookies: cookieStore })
  if (payloadTenant) return payloadTenant
  return null
}

/**
 * Returns the Stripe Connect account ID for the tenant resolved from the request (context or payload-tenant cookie).
 * Returns null if no tenant, tenant not found, or tenant has no Connect account / not active.
 */
export async function getStripeAccountIdForRequest(req: PayloadRequest): Promise<string | null> {
  let tenantId = getTenantIdFromRequest(req)
  if (tenantId == null) {
    const cookieStore = (req as PayloadRequest & { cookies?: { get: (name: string) => { value?: string } | undefined } }).cookies
    const tenantSlug = getTenantSlugFromRequest({ cookies: cookieStore })
    if (tenantSlug && /^[a-z0-9-]+$/i.test(tenantSlug)) {
      const tenantFromSlug = await req.payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      }).catch(() => null)
      const id = tenantFromSlug?.docs?.[0]?.id
      if (typeof id === 'number' && Number.isFinite(id)) {
        tenantId = id
        if (req.context) {
          ;(req.context as Record<string, unknown>).__stripeTenantIdFromSlug = id
        }
      }
    }
  }
  if (tenantId == null) return null
  const tenant = await req.payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: { stripeConnectAccountId: true, stripeConnectOnboardingStatus: true } as any,
  }).catch(() => null)
  if (!tenant) return null
  const t = tenant as { stripeConnectAccountId?: string | null; stripeConnectOnboardingStatus?: string | null }
  if (!t.stripeConnectAccountId?.trim() || t.stripeConnectOnboardingStatus !== 'active') return null
  if (isStripeTestAccount(t.stripeConnectAccountId)) return null
  return t.stripeConnectAccountId
}

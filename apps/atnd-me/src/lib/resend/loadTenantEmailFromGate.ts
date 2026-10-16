import type { BasePayload } from 'payload'
import { isEmailDomainVerified } from './resolveTenantEmailFrom'
import type { TenantEmailFromGate } from '@/lib/post-booking-email/send-post-booking-email'

export async function loadTenantEmailFromGate(
  payload: BasePayload,
  tenantId: string | number | null | undefined,
): Promise<TenantEmailFromGate | null> {
  if (tenantId == null) return null
  const tenant = await payload
    .findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      select: {
        domain: true,
        hostnames: true,
        direction: true,
        slug: true,
        emailDomainStatus: true,
      } as Record<string, boolean>,
    })
    .catch(() => null)
  if (!tenant) return null
  const doc = tenant as {
    domain?: unknown
    hostnames?: unknown
    direction?: unknown
    slug?: unknown
    emailDomainStatus?: unknown
  }
  return {
    domain: typeof doc.domain === 'string' ? doc.domain : null,
    hostnames: doc.hostnames,
    direction: doc.direction,
    slug: typeof doc.slug === 'string' ? doc.slug : null,
    verified: isEmailDomainVerified(doc.emailDomainStatus),
  }
}

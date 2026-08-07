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
      select: { domain: true, emailDomainStatus: true } as Record<string, boolean>,
    })
    .catch(() => null)
  if (!tenant) return null
  return {
    domain: typeof (tenant as any).domain === 'string' ? (tenant as any).domain : null,
    verified: isEmailDomainVerified((tenant as any).emailDomainStatus),
  }
}

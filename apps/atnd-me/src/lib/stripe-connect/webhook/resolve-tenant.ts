/**
 * Resolve tenant from Stripe Connect webhook event (account ID or metadata).
 */
import type { StripeConnectEvent } from '../webhookVerify'

export type Tenant = { id: number } | null

/** Get Stripe Connect account ID from event. */
export function getAccountIdFromEvent(event: StripeConnectEvent): string | undefined {
  const account = event.account
  return typeof account === 'string'
    ? account
    : (account as { id?: string } | undefined)?.id
}

/** Resolve tenant from account ID (stripeConnectAccountId) or metadata tenantId. */
export async function resolveTenant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  accountId: string | undefined,
  metaTenantId?: string
): Promise<Tenant> {
  if (accountId) {
    const result = await payload.find({
      collection: 'tenants',
      where: { stripeConnectAccountId: { equals: accountId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: { id: true } as any,
    })
    const tenant = result.docs[0] as Tenant
    if (tenant) return tenant
  }
  if (metaTenantId) {
    try {
      const t = await payload.findByID({
        collection: 'tenants',
        id: Number(metaTenantId),
        overrideAccess: true,
        depth: 0,
        select: { id: true } as any,
      })
      return t as Tenant
    } catch {
      return null
    }
  }
  return null
}

import type { Plan, Subscription } from '@repo/shared-types'
import type { Payload } from 'payload'

function resolveRelationshipId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return parseInt(value.trim(), 10)
  if (value && typeof value === 'object' && 'id' in value) {
    return resolveRelationshipId((value as { id: unknown }).id)
  }
  return null
}

/**
 * Only **`plan.tenant`** decides which site a membership applies to (product + Stripe Connect context).
 * `subscription.tenant` may be missing or wrong after sync; matching on it alone could show the
 * wrong plan or open the wrong customer portal on another tenant’s host.
 */
export function subscriptionBelongsToTenantContext(sub: Subscription, tenantId: number): boolean {
  const plan = (sub as Subscription & { tenant?: unknown }).plan
  if (!plan || typeof plan !== 'object' || !('tenant' in plan)) {
    return false
  }
  const planTenantId = resolveRelationshipId((plan as Plan & { tenant?: unknown }).tenant)
  return planTenantId === tenantId
}

const ACTIVE_SUBSCRIPTION_STATUSES_EXCLUDED = [
  'canceled',
  'unpaid',
  'incomplete_expired',
  'incomplete',
] as const

export async function findActiveMembershipSubscriptionForTenant(
  payload: Payload,
  userId: number,
  tenantId: number,
): Promise<Subscription | null> {
  const result = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        { user: { equals: userId } },
        { status: { not_in: [...ACTIVE_SUBSCRIPTION_STATUSES_EXCLUDED] } },
        {
          or: [{ endDate: { greater_than: new Date() } }, { endDate: { equals: null } }],
        },
      ],
    },
    sort: '-updatedAt',
    limit: 40,
    depth: 3,
    overrideAccess: true,
  })

  const docs = result.docs as Subscription[]
  return docs.find((doc) => subscriptionBelongsToTenantContext(doc, tenantId)) ?? null
}

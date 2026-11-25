import type { Plan, Subscription } from '@repo/shared-types'
import type { Payload, Where } from 'payload'

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

/**
 * Same window booking uses in `checkUserSubscription` / `getMaxSubscriptionQuantityPerTimeslot`:
 * status active, startDate ≤ now ≤ endDate, and cancelAt not already passed.
 */
export function isMembershipSubscriptionCurrentlyActive(
  sub: Pick<Subscription, 'status' | 'startDate' | 'endDate' | 'cancelAt'>,
  now: Date = new Date(),
): boolean {
  if (sub.status !== 'active') return false

  if (sub.startDate == null || sub.startDate === '') return false
  if (new Date(sub.startDate).getTime() > now.getTime()) return false

  if (sub.endDate == null || sub.endDate === '') return false
  if (new Date(sub.endDate).getTime() < now.getTime()) return false

  if (sub.cancelAt != null && sub.cancelAt !== '') {
    if (new Date(sub.cancelAt).getTime() <= now.getTime()) return false
  }

  return true
}

/** Payload where clause matching {@link isMembershipSubscriptionCurrentlyActive}. */
export function activeMembershipSubscriptionWhere(userId: number, now: Date = new Date()): Where {
  return {
    and: [
      { user: { equals: userId } },
      { status: { equals: 'active' } },
      { startDate: { less_than_equal: now } },
      { endDate: { greater_than_equal: now } },
      {
        or: [
          { cancelAt: { greater_than: now } },
          { cancelAt: { exists: false } },
          { cancelAt: { equals: null } },
        ],
      },
    ],
  }
}

export async function findActiveMembershipSubscriptionForTenant(
  payload: Payload,
  userId: number,
  tenantId: number,
): Promise<Subscription | null> {
  const now = new Date()
  const result = await payload.find({
    collection: 'subscriptions',
    where: activeMembershipSubscriptionWhere(userId, now),
    sort: '-updatedAt',
    limit: 40,
    depth: 3,
    overrideAccess: true,
  })

  const docs = result.docs as Subscription[]
  return (
    docs.find(
      (doc) =>
        isMembershipSubscriptionCurrentlyActive(doc, now) &&
        subscriptionBelongsToTenantContext(doc, tenantId),
    ) ?? null
  )
}

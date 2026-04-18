import type { CollectionSlug } from 'payload'

import type { Plan, Subscription } from '@repo/shared-types'

import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { DashboardMembershipPanel } from '@/components/membership/DashboardMembershipPanel'

import { currentUser, getSession } from '@/lib/auth/context/get-context-props'
import { getPayload } from '@/lib/payload'

/** Normalize Payload / Better Auth user id for relationship queries. */
function membershipUserId(user: unknown): number | null {
  if (!user || typeof user !== 'object') return null
  const id = (user as { id?: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return parseInt(id.trim(), 10)
  return null
}

export async function DhLiveMembershipAsync() {
  const tenantId = await resolveTenantIdFromServerContext()
  const session = await getSession()
  // Better Auth `getSession` can return null on some hosts/cookie edges while `payload.auth` still
  // resolves the same cookies (common on custom domains + host-only session cookies).
  const user = session?.user ?? (await currentUser())

  const payload = await getPayload()

  if (tenantId == null) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Membership is unavailable: no tenant context for this page.
      </p>
    )
  }

  const plansResult = await payload.find({
    collection: 'plans' as CollectionSlug,
    where: {
      and: [{ status: { equals: 'active' } }, { tenant: { equals: tenantId } }],
    },
    depth: 2,
    overrideAccess: true,
  })

  let activeSubscription: Subscription | null = null

  const userId = membershipUserId(user)
  if (userId != null) {
    const subscription = await payload.find({
      collection: 'subscriptions',
      where: {
        and: [
          { user: { equals: userId } },
          { tenant: { equals: tenantId } },
          { status: { not_in: ['canceled', 'unpaid', 'incomplete_expired', 'incomplete'] } },
          {
            or: [
              { endDate: { greater_than: new Date() } },
              { endDate: { equals: null } },
            ],
          },
        ],
      },
      depth: 3,
      overrideAccess: true,
    })
    activeSubscription = (subscription.docs[0] as Subscription | undefined) ?? null
  }

  return (
    <DashboardMembershipPanel
      plans={plansResult.docs as Plan[]}
      subscription={activeSubscription}
      tenantId={tenantId}
    />
  )
}

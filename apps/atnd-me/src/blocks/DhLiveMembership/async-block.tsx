import type { CollectionSlug } from 'payload'

import type { Plan, Subscription } from '@repo/shared-types'

import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { DashboardMembershipPanel } from '@/components/membership/DashboardMembershipPanel'

import { getSession } from '@/lib/auth/context/get-context-props'
import { getPayload } from '@/lib/payload'

export async function DhLiveMembershipAsync() {
  const tenantId = await resolveTenantIdFromServerContext()
  const session = await getSession()
  const user = session?.user

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

  if (user) {
    const subscription = await payload.find({
      collection: 'subscriptions',
      where: {
        and: [
          { user: { equals: user.id } },
          { tenant: { equals: tenantId } },
          { status: { not_in: ['canceled', 'unpaid', 'incomplete_expired', 'incomplete'] } },
          { endDate: { greater_than: new Date() } },
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
    />
  )
}

import type { CollectionSlug } from 'payload'
import {
  allowedEventTypeIdsIncludingOverrides,
  type EventTypeOverrideRow,
} from '@repo/shared-services'

import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { findActiveMembershipSubscriptionForTenant } from '@/blocks/DhLiveMembership/subscription-tenant-context'
import { mediaUrl } from '@/components/events/eventPageTypes'
import { currentUser, getSession } from '@/lib/auth/context/get-context-props'
import { getPayload } from '@/lib/payload'
import type { Media } from '@/payload-types'

import {
  SubscriptionCheckoutCards,
  type SubscriptionCheckoutCard,
} from './SubscriptionCheckoutCards.client'
import { resolvePlanPriceId } from './resolvePlanPriceId'

type PlanRow = {
  plan?: number | { id?: number | null } | null
  image?: number | Media | null
  description?: string | null
}

type SubscriptionCheckoutBlockProps = {
  heading?: string | null
  plans?: PlanRow[] | null
}

function relationId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

function isLoggedInUser(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false
  const id = (user as { id?: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id) && id > 0) return true
  if (typeof id === 'string' && /^\d+$/.test(id.trim()) && Number(id) > 0) return true
  return false
}

function membershipUserId(user: unknown): number | null {
  if (!user || typeof user !== 'object') return null
  const id = (user as { id?: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id.trim())) return parseInt(id.trim(), 10)
  return null
}

function formatPriceLabel(doc: {
  priceInformation?: {
    price?: number | null
    interval?: string | null
    intervalCount?: number | null
  } | null
}): string | null {
  const info = doc.priceInformation
  if (!info || typeof info.price !== 'number') return null
  const base = `€${info.price.toFixed(2)}`
  if (!info.interval) return base
  const count =
    typeof info.intervalCount === 'number' && info.intervalCount > 1
      ? info.intervalCount
      : null
  const intervalDisplay = count ? `${count} ${info.interval}s` : info.interval
  return `${base}/${intervalDisplay}`
}

export async function SubscriptionCheckoutAsync(props: SubscriptionCheckoutBlockProps) {
  const tenantId = await resolveTenantIdFromServerContext()
  const session = await getSession()
  const user = session?.user ?? (await currentUser())
  const loggedIn = isLoggedInUser(user)

  if (tenantId == null) {
    return (
      <p className="text-sm text-muted-foreground">
        Subscriptions are unavailable: no tenant context for this page.
      </p>
    )
  }

  const rows = Array.isArray(props.plans) ? props.plans : []
  const planIds = rows
    .map((row) => relationId(row.plan))
    .filter((id): id is number => id != null)

  if (planIds.length === 0) {
    return (
      <SubscriptionCheckoutCards
        heading={props.heading}
        cards={[]}
        tenantId={tenantId}
        isLoggedIn={loggedIn}
        activePlanId={null}
      />
    )
  }

  const payload = await getPayload()

  const tenantDoc = await payload
    .findByID({
      collection: 'tenants' as CollectionSlug,
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  const tenantStripeAccountId =
    tenantDoc &&
    typeof (tenantDoc as { stripeConnectAccountId?: unknown }).stripeConnectAccountId ===
      'string' &&
    String((tenantDoc as { stripeConnectAccountId: string }).stripeConnectAccountId).trim() &&
    (tenantDoc as { stripeConnectOnboardingStatus?: unknown }).stripeConnectOnboardingStatus ===
      'active'
      ? String((tenantDoc as { stripeConnectAccountId: string }).stripeConnectAccountId).trim()
      : null

  const stripeOpts = tenantStripeAccountId
    ? ({ stripeAccount: tenantStripeAccountId } as const)
    : undefined

  const plansResult = await payload.find({
    collection: 'plans' as CollectionSlug,
    where: {
      and: [
        { id: { in: planIds } },
        { status: { equals: 'active' } },
        { tenant: { equals: tenantId } },
      ],
    },
    limit: planIds.length,
    depth: 0,
    overrideAccess: true,
  })

  const planById = new Map<number, (typeof plansResult.docs)[number]>()
  for (const doc of plansResult.docs) {
    if (typeof doc?.id === 'number') planById.set(doc.id, doc)
  }

  const eligibleIdsByPlanId = new Map<number, number[]>()
  const allEligibleEventTypeIds = new Set<number>()
  for (const [planId, doc] of planById) {
    const { ids } = allowedEventTypeIdsIncludingOverrides(
      (doc as { allowedEventTypes?: unknown }).allowedEventTypes,
      (
        doc as {
          sessionsInformation?: {
            eventTypeOverrides?: Array<EventTypeOverrideRow | null | undefined> | null
          } | null
        }
      ).sessionsInformation?.eventTypeOverrides,
    )
    eligibleIdsByPlanId.set(planId, ids)
    for (const id of ids) allEligibleEventTypeIds.add(id)
  }

  const eventTypeNameById = new Map<number, string>()
  if (allEligibleEventTypeIds.size > 0) {
    const eventTypesResult = await payload.find({
      collection: 'event-types' as CollectionSlug,
      where: {
        and: [
          { id: { in: Array.from(allEligibleEventTypeIds) } },
          { tenant: { equals: tenantId } },
        ],
      },
      limit: allEligibleEventTypeIds.size,
      depth: 0,
      overrideAccess: true,
      select: { name: true },
    })
    for (const et of eventTypesResult.docs) {
      if (typeof et?.id === 'number' && typeof (et as { name?: unknown }).name === 'string') {
        eventTypeNameById.set(et.id, String((et as { name: string }).name))
      }
    }
  }

  let activePlanId: number | null = null
  const userId = membershipUserId(user)
  if (userId != null) {
    const activeSubscription = await findActiveMembershipSubscriptionForTenant(
      payload,
      userId,
      tenantId,
    )
    if (activeSubscription) {
      activePlanId = relationId(activeSubscription.plan)
    }
  }

  const cards: SubscriptionCheckoutCard[] = []

  for (const row of rows) {
    const planId = relationId(row.plan)
    if (planId == null) continue
    const doc = planById.get(planId)
    if (!doc) continue

    const priceId = await resolvePlanPriceId(
      doc as { priceJSON?: unknown; stripeProductId?: unknown },
      stripeOpts,
    )
    if (!priceId) continue

    const image =
      row.image && typeof row.image === 'object' ? (row.image as Media) : null
    const imageUrl = mediaUrl(image)

    const overrideDescription =
      typeof row.description === 'string' && row.description.trim()
        ? row.description.trim()
        : null

    const footerText =
      typeof (doc as { footerText?: unknown }).footerText === 'string'
        ? String((doc as { footerText: string }).footerText)
        : null

    const featuresRaw = (doc as { features?: Array<{ feature?: string | null } | null> | null })
      .features
    const features = Array.isArray(featuresRaw)
      ? featuresRaw
          .map((f) => (f && typeof f.feature === 'string' ? f.feature.trim() : ''))
          .filter((f) => f.length > 0)
      : []

    const eligibleEventTypes = (eligibleIdsByPlanId.get(planId) ?? [])
      .map((id) => eventTypeNameById.get(id))
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)

    const price =
      typeof (doc as { priceInformation?: { price?: unknown } }).priceInformation?.price ===
      'number'
        ? (doc as { priceInformation: { price: number } }).priceInformation.price
        : null

    cards.push({
      planId,
      name:
        typeof (doc as { name?: unknown }).name === 'string'
          ? String((doc as { name: string }).name)
          : 'Membership',
      description: overrideDescription,
      features,
      eligibleEventTypes,
      priceLabel: formatPriceLabel(
        doc as {
          priceInformation?: {
            price?: number | null
            interval?: string | null
            intervalCount?: number | null
          } | null
        },
      ),
      price,
      priceId,
      imageUrl,
      imageAlt: image?.alt ?? null,
      footerText: overrideDescription ? null : footerText,
    })
  }

  return (
    <SubscriptionCheckoutCards
      heading={props.heading}
      cards={cards}
      tenantId={tenantId}
      isLoggedIn={loggedIn}
      activePlanId={activePlanId}
    />
  )
}

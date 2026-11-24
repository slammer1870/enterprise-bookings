import type { CollectionSlug } from 'payload'
import {
  allowedEventTypeIdsIncludingOverrides,
  type EventTypeOverrideRow,
} from '@repo/shared-services'

import { resolveTenantIdFromServerContext } from '@/access/tenant-scoped'
import { mediaUrl } from '@/components/events/eventPageTypes'
import { currentUser, getSession } from '@/lib/auth/context/get-context-props'
import { getPayload } from '@/lib/payload'
import type { Media } from '@/payload-types'

import {
  ClassPassCheckoutCards,
  type ClassPassCheckoutCard,
} from './ClassPassCheckoutCards.client'
import { resolveClassPassPriceId } from './resolveClassPassPriceId'

type PassRow = {
  classPassType?: number | { id?: number | null } | null
  image?: number | Media | null
  description?: string | null
}

type ClassPassCheckoutBlockProps = {
  heading?: string | null
  passes?: PassRow[] | null
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

export async function ClassPassCheckoutAsync(props: ClassPassCheckoutBlockProps) {
  const tenantId = await resolveTenantIdFromServerContext()
  const session = await getSession()
  const user = session?.user ?? (await currentUser())
  const loggedIn = isLoggedInUser(user)

  if (tenantId == null) {
    return (
      <p className="text-sm text-muted-foreground">
        Class passes are unavailable: no tenant context for this page.
      </p>
    )
  }

  const rows = Array.isArray(props.passes) ? props.passes : []
  const typeIds = rows
    .map((row) => relationId(row.classPassType))
    .filter((id): id is number => id != null)

  if (typeIds.length === 0) {
    return (
      <ClassPassCheckoutCards
        heading={props.heading}
        cards={[]}
        tenantId={tenantId}
        isLoggedIn={loggedIn}
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

  const typesResult = await payload.find({
    collection: 'class-pass-types' as CollectionSlug,
    where: {
      and: [
        { id: { in: typeIds } },
        { status: { equals: 'active' } },
        { tenant: { equals: tenantId } },
      ],
    },
    limit: typeIds.length,
    depth: 0,
    overrideAccess: true,
  })

  const typeById = new Map<number, (typeof typesResult.docs)[number]>()
  for (const doc of typesResult.docs) {
    if (typeof doc?.id === 'number') typeById.set(doc.id, doc)
  }

  const eligibleIdsByTypeId = new Map<number, number[]>()
  const allEligibleEventTypeIds = new Set<number>()
  for (const [typeId, doc] of typeById) {
    const { ids } = allowedEventTypeIdsIncludingOverrides(
      (doc as { allowedEventTypes?: unknown }).allowedEventTypes,
      (doc as { eventTypeOverrides?: Array<EventTypeOverrideRow | null | undefined> | null })
        .eventTypeOverrides,
    )
    eligibleIdsByTypeId.set(typeId, ids)
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

  const cards: ClassPassCheckoutCard[] = []

  for (const row of rows) {
    const typeId = relationId(row.classPassType)
    if (typeId == null) continue
    const doc = typeById.get(typeId)
    if (!doc) continue

    const priceId = await resolveClassPassPriceId(
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
    const typeDescription =
      typeof (doc as { description?: unknown }).description === 'string'
        ? String((doc as { description: string }).description)
        : null

    const eligibleEventTypes = (eligibleIdsByTypeId.get(typeId) ?? [])
      .map((id) => eventTypeNameById.get(id))
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)

    cards.push({
      classPassTypeId: typeId,
      name:
        typeof (doc as { name?: unknown }).name === 'string'
          ? String((doc as { name: string }).name)
          : 'Class pass',
      description: overrideDescription ?? typeDescription,
      quantity:
        typeof (doc as { quantity?: unknown }).quantity === 'number'
          ? (doc as { quantity: number }).quantity
          : 0,
      daysUntilExpiration:
        typeof (doc as { daysUntilExpiration?: unknown }).daysUntilExpiration === 'number'
          ? (doc as { daysUntilExpiration: number }).daysUntilExpiration
          : null,
      price:
        typeof (doc as { priceInformation?: { price?: unknown } }).priceInformation?.price ===
        'number'
          ? (doc as { priceInformation: { price: number } }).priceInformation.price
          : null,
      priceId,
      imageUrl,
      imageAlt: image?.alt ?? null,
      eligibleEventTypes,
    })
  }

  return (
    <ClassPassCheckoutCards
      heading={props.heading}
      cards={cards}
      tenantId={tenantId}
      isLoggedIn={loggedIn}
    />
  )
}

import type { CollectionSlug } from 'payload'
import {
  BOOKINGS_COLLECTION_SLUG,
  CHECKOUT_HOLD_COLLECTION_SLUG,
  EVENT_TYPES_COLLECTION_SLUG,
  TIMESLOTS_COLLECTION_SLUG,
  HOLD_FULFILLMENT_GRACE_MS,
  HOLD_MAX_LIFETIME_MS,
  HOLD_TTL_MS,
  type CheckoutHoldStatus,
} from './constants'

type PayloadLike = any

export type CheckoutHoldRecord = {
  id: number
  user: number | { id: number }
  timeslot: number | { id: number }
  tenant?: number | { id: number }
  quantity: number
  expiresAt: string
  firstUpsertedAt?: string
  status: CheckoutHoldStatus | string
  stripePaymentIntentId?: string | null
  failureReason?: string | null
}

export type UpsertCheckoutHoldResult = {
  holdId: number
  quantity: number
  expiresAt: string
}

function relationId(value: number | { id: number } | null | undefined): number | null {
  if (value == null) return null
  return typeof value === 'object' ? value.id : value
}

export function isHoldActive(
  hold: Pick<CheckoutHoldRecord, 'status' | 'expiresAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (hold.status !== 'active') return false
  return Date.parse(hold.expiresAt) > nowMs
}

export function isHoldWithinFulfillmentGrace(
  hold: Pick<CheckoutHoldRecord, 'expiresAt'>,
  nowMs: number = Date.now(),
): boolean {
  return Date.parse(hold.expiresAt) + HOLD_FULFILLMENT_GRACE_MS >= nowMs
}

function expiresAtFromNow(nowMs: number = Date.now()) {
  return new Date(nowMs + HOLD_TTL_MS).toISOString()
}

export function formatCapacityError(remaining: number, requested: number): string {
  if (remaining === 0) return 'This timeslot is fully booked.'
  return `Only ${remaining} spot${remaining !== 1 ? 's' : ''} available. You requested ${requested}.`
}

async function getPlacesForTimeslot(
  payload: PayloadLike,
  timeslotId: number,
  timeslotsSlug: CollectionSlug = TIMESLOTS_COLLECTION_SLUG,
  eventTypesSlug: CollectionSlug = EVENT_TYPES_COLLECTION_SLUG,
): Promise<number> {
  const timeslot = (await payload.findByID({
    collection: timeslotsSlug,
    id: timeslotId,
    depth: 1,
    overrideAccess: true,
  })) as { eventType?: number | { id: number; places?: number } | null } | null

  if (!timeslot?.eventType) return 0

  const eventTypeRaw = timeslot.eventType
  if (typeof eventTypeRaw === 'object' && eventTypeRaw !== null && 'places' in eventTypeRaw) {
    const places = eventTypeRaw.places
    return typeof places === 'number' ? places : 0
  }

  const eventTypeId =
    typeof eventTypeRaw === 'object' && eventTypeRaw !== null ? eventTypeRaw.id : eventTypeRaw

  const eventType = (await payload.findByID({
    collection: eventTypesSlug,
    id: eventTypeId,
    depth: 0,
    overrideAccess: true,
  })) as { places?: number } | null

  return typeof eventType?.places === 'number' ? eventType.places : 0
}

async function countConfirmedBookings(
  payload: PayloadLike,
  timeslotId: number,
  bookingsSlug: CollectionSlug = BOOKINGS_COLLECTION_SLUG,
): Promise<number> {
  const result = await payload.find({
    collection: bookingsSlug,
    where: {
      and: [{ timeslot: { equals: timeslotId } }, { status: { equals: 'confirmed' } }],
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return result.totalDocs ?? 0
}

async function findActiveHoldsForTimeslot(
  payload: PayloadLike,
  timeslotId: number,
  holdCollection: CollectionSlug = CHECKOUT_HOLD_COLLECTION_SLUG,
): Promise<CheckoutHoldRecord[]> {
  const nowIso = new Date().toISOString()
  const result = await payload.find({
    collection: holdCollection,
    where: {
      and: [
        { timeslot: { equals: timeslotId } },
        { status: { equals: 'active' } },
        { expiresAt: { greater_than: nowIso } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs ?? []) as CheckoutHoldRecord[]
}

export async function countActiveHoldQuantityForTimeslot(
  payload: PayloadLike,
  timeslotId: number,
  holdCollection: CollectionSlug = CHECKOUT_HOLD_COLLECTION_SLUG,
): Promise<number> {
  const holds = await findActiveHoldsForTimeslot(payload, timeslotId, holdCollection)
  return holds.reduce((sum, h) => sum + (h.quantity ?? 0), 0)
}

async function findUserActiveHold(
  payload: PayloadLike,
  opts: { timeslotId: number; userId: number },
  holdCollection: CollectionSlug = CHECKOUT_HOLD_COLLECTION_SLUG,
): Promise<CheckoutHoldRecord | null> {
  const nowIso = new Date().toISOString()
  const result = await payload.find({
    collection: holdCollection,
    where: {
      and: [
        { timeslot: { equals: opts.timeslotId } },
        { user: { equals: opts.userId } },
        { status: { equals: 'active' } },
        { expiresAt: { greater_than: nowIso } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs?.[0] as CheckoutHoldRecord | undefined) ?? null
}

async function assertCapacityForHold(
  payload: PayloadLike,
  opts: {
    timeslotId: number
    userId: number
    quantity: number
    existingUserHold?: CheckoutHoldRecord | null
    timeslotsSlug?: CollectionSlug
    eventTypesSlug?: CollectionSlug
    bookingsSlug?: CollectionSlug
    holdCollection?: CollectionSlug
  },
): Promise<void> {
  const places = await getPlacesForTimeslot(
    payload,
    opts.timeslotId,
    opts.timeslotsSlug,
    opts.eventTypesSlug,
  )
  const confirmed = await countConfirmedBookings(payload, opts.timeslotId, opts.bookingsSlug)
  const activeHolds = await findActiveHoldsForTimeslot(
    payload,
    opts.timeslotId,
    opts.holdCollection,
  )

  const otherHoldsQty = activeHolds
    .filter((h) => relationId(h.user) !== opts.userId)
    .reduce((sum, h) => sum + h.quantity, 0)

  const totalNeeded = confirmed + otherHoldsQty + opts.quantity
  const remaining = places - confirmed - otherHoldsQty

  if (totalNeeded > places) {
    throw new Error(formatCapacityError(Math.max(0, remaining), opts.quantity))
  }
}

function tenantContextForHold(tenantId: number) {
  return { tenant: tenantId }
}

export async function upsertCheckoutHold(
  payload: PayloadLike,
  opts: {
    timeslotId: number
    userId: number
    tenantId: number
    quantity: number
    holdCollection?: CollectionSlug
    timeslotsSlug?: CollectionSlug
    eventTypesSlug?: CollectionSlug
    bookingsSlug?: CollectionSlug
  },
): Promise<UpsertCheckoutHoldResult> {
  const holdCollection = opts.holdCollection ?? CHECKOUT_HOLD_COLLECTION_SLUG
  const quantity = Math.max(1, opts.quantity)
  const userId = Number(opts.userId)
  const nowMs = Date.now()
  const expiresAt = expiresAtFromNow(nowMs)
  const tenantContext = tenantContextForHold(opts.tenantId)

  const existing = await findUserActiveHold(
    payload,
    { timeslotId: opts.timeslotId, userId },
    holdCollection,
  )

  await assertCapacityForHold(payload, {
    timeslotId: opts.timeslotId,
    userId,
    quantity,
    existingUserHold: existing,
    timeslotsSlug: opts.timeslotsSlug,
    eventTypesSlug: opts.eventTypesSlug,
    bookingsSlug: opts.bookingsSlug,
    holdCollection,
  })

  if (existing) {
    const updated = (await payload.update({
      collection: holdCollection,
      id: existing.id,
      data: {
        quantity,
        expiresAt,
        tenant: opts.tenantId,
      },
      context: tenantContext,
      overrideAccess: true,
    })) as CheckoutHoldRecord

    return {
      holdId: updated.id,
      quantity: updated.quantity,
      expiresAt: updated.expiresAt,
    }
  }

  const created = (await payload.create({
    collection: holdCollection,
    data: {
      user: userId,
      timeslot: opts.timeslotId,
      tenant: opts.tenantId,
      quantity,
      expiresAt,
      firstUpsertedAt: new Date(nowMs).toISOString(),
      status: 'active',
    },
    context: tenantContext,
    overrideAccess: true,
  })) as CheckoutHoldRecord

  return {
    holdId: created.id,
    quantity: created.quantity,
    expiresAt: created.expiresAt,
  }
}

export async function adjustCheckoutHoldQuantity(
  payload: PayloadLike,
  opts: {
    timeslotId: number
    userId: number
    tenantId: number
    quantity: number
    holdCollection?: CollectionSlug
    timeslotsSlug?: CollectionSlug
    eventTypesSlug?: CollectionSlug
    bookingsSlug?: CollectionSlug
  },
): Promise<UpsertCheckoutHoldResult> {
  return upsertCheckoutHold(payload, opts)
}

export async function releaseCheckoutHold(
  payload: PayloadLike,
  opts: {
    timeslotId: number
    userId: number
    holdCollection?: CollectionSlug
  },
): Promise<{ released: number }> {
  const holdCollection = opts.holdCollection ?? CHECKOUT_HOLD_COLLECTION_SLUG
  const nowIso = new Date().toISOString()

  const active = await payload.find({
    collection: holdCollection,
    where: {
      and: [
        { timeslot: { equals: opts.timeslotId } },
        { user: { equals: opts.userId } },
        { status: { equals: 'active' } },
        { expiresAt: { greater_than: nowIso } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  const docs = (active.docs ?? []) as CheckoutHoldRecord[]
  for (const doc of docs) {
    await payload.delete({
      collection: holdCollection,
      id: doc.id,
      overrideAccess: true,
    })
  }

  return { released: docs.length }
}

export async function extendCheckoutHold(
  payload: PayloadLike,
  opts: {
    timeslotId: number
    userId: number
    holdCollection?: CollectionSlug
  },
): Promise<{ holdId: number; expiresAt: string }> {
  const holdCollection = opts.holdCollection ?? CHECKOUT_HOLD_COLLECTION_SLUG
  const existing = await findUserActiveHold(
    payload,
    { timeslotId: opts.timeslotId, userId: opts.userId },
    holdCollection,
  )

  if (!existing) {
    throw new Error('No active checkout hold found for this timeslot.')
  }

  const nowMs = Date.now()
  const firstUpsertedAt = existing.firstUpsertedAt ?? existing.expiresAt
  if (Date.parse(firstUpsertedAt) + HOLD_MAX_LIFETIME_MS <= nowMs) {
    throw new Error('Checkout reservation has reached the maximum hold time. Please start again.')
  }

  const expiresAt = expiresAtFromNow(nowMs)
  const updated = (await payload.update({
    collection: holdCollection,
    id: existing.id,
    data: { expiresAt },
    overrideAccess: true,
  })) as CheckoutHoldRecord

  return { holdId: updated.id, expiresAt: updated.expiresAt }
}

export async function getActiveCheckoutHold(
  payload: PayloadLike,
  opts: { timeslotId: number; userId: number; holdCollection?: CollectionSlug },
): Promise<CheckoutHoldRecord | null> {
  return findUserActiveHold(
    payload,
    { timeslotId: opts.timeslotId, userId: opts.userId },
    opts.holdCollection ?? CHECKOUT_HOLD_COLLECTION_SLUG,
  )
}

export async function computeRemainingCapacityWithHolds(
  payload: PayloadLike,
  timeslotId: number,
  slugs?: {
    timeslotsSlug?: CollectionSlug
    eventTypesSlug?: CollectionSlug
    bookingsSlug?: CollectionSlug
    holdCollection?: CollectionSlug
  },
): Promise<number> {
  const places = await getPlacesForTimeslot(
    payload,
    timeslotId,
    slugs?.timeslotsSlug,
    slugs?.eventTypesSlug,
  )
  const confirmed = await countConfirmedBookings(payload, timeslotId, slugs?.bookingsSlug)
  const held = await countActiveHoldQuantityForTimeslot(
    payload,
    timeslotId,
    slugs?.holdCollection,
  )
  return Math.max(0, places - confirmed - held)
}

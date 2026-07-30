import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { ensureGuestUser } from '@/lib/booking/ensureGuestUser'
import {
  resolveTenantSlugOrId,
  resolveTenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import {
  upsertCheckoutHold,
  computeCapacityBreakdownWithHolds,
  CHECKOUT_HOLD_COLLECTION_SLUG,
} from '@repo/bookings-payments'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'

export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

/**
 * POST /api/events/guest-reserve-hold
 * Body: { timeslotId, quantity?, guestName, guestEmail, checkoutSessionId? }
 *
 * Reserves capacity as soon as the guest clicks Continue — before PaymentIntent
 * creation — so page-exit release has something to clear.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const timeslotIdRaw = (body as { timeslotId?: unknown }).timeslotId
  const timeslotId =
    typeof timeslotIdRaw === 'number'
      ? timeslotIdRaw
      : parseInt(String(timeslotIdRaw ?? ''), 10)
  if (!Number.isFinite(timeslotId) || timeslotId <= 0) {
    return NextResponse.json({ error: 'timeslotId is required' }, { status: 400 })
  }

  const guestName =
    typeof (body as { guestName?: unknown }).guestName === 'string'
      ? (body as { guestName: string }).guestName.trim()
      : ''
  const guestEmailRaw =
    typeof (body as { guestEmail?: unknown }).guestEmail === 'string'
      ? (body as { guestEmail: string }).guestEmail
      : ''
  const guestEmail = guestEmailRaw.trim().toLowerCase()
  const checkoutSessionIdRaw = (body as { checkoutSessionId?: unknown }).checkoutSessionId
  const checkoutSessionId =
    typeof checkoutSessionIdRaw === 'string' && checkoutSessionIdRaw.trim()
      ? checkoutSessionIdRaw.trim()
      : null

  if (!guestName || guestName.length < 2) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const quantityRaw = (body as { quantity?: unknown }).quantity
  const quantity = Math.max(
    1,
    typeof quantityRaw === 'number'
      ? quantityRaw
      : parseInt(String(quantityRaw ?? '1'), 10) || 1,
  )

  const ip = clientIp(request)
  const ipLimit = checkRateLimit({
    key: `guest-reserve-hold:ip:${ip}`,
    limit: 40,
    windowMs: 60 * 60 * 1000,
  })
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const payload = await getPayload()

  const timeslot = (await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 0,
    overrideAccess: true,
  })) as { id?: number; active?: boolean | null; tenant?: number | { id: number } } | null

  if (!timeslot || timeslot.active === false) {
    return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 })
  }

  const tenantId =
    timeslot.tenant != null
      ? typeof timeslot.tenant === 'object' && timeslot.tenant !== null
        ? timeslot.tenant.id
        : timeslot.tenant
      : null

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context not found for timeslot' }, { status: 400 })
  }

  const requestTenantSlugOrId = resolveTenantSlugOrId(request)
  if (requestTenantSlugOrId != null) {
    const requestNumericId = /^\d+$/.test(requestTenantSlugOrId)
      ? parseInt(requestTenantSlugOrId, 10)
      : null
    if (requestNumericId != null) {
      if (requestNumericId !== tenantId) {
        return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 })
      }
    } else {
      const requestTenant = await resolveTenantForConnect(payload, requestTenantSlugOrId)
      if (requestTenant != null && requestTenant.id !== tenantId) {
        return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 })
      }
    }
  }

  let guest: { userId: number; email: string; name: string }
  try {
    guest = await ensureGuestUser({
      payload,
      name: guestName,
      email: guestEmail,
      tenantId,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unable to create guest account'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const hold = await upsertCheckoutHold(payload, {
      timeslotId,
      userId: guest.userId,
      tenantId,
      quantity,
      checkoutSessionId,
      holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
      timeslotsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      eventTypesSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
      bookingsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    })
    if (hold.abandoned) {
      return NextResponse.json({
        holdId: null,
        quantity: 0,
        abandoned: true,
      })
    }
    const remaining = await computeCapacityBreakdownWithHolds(payload, timeslotId, {
      timeslotsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      eventTypesSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
      bookingsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
      holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
    })
    return NextResponse.json({
      holdId: hold.holdId,
      quantity: hold.quantity,
      remainingCapacity: remaining.remaining,
      remainingConfirmedOnly: remaining.remainingConfirmedOnly,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unable to reserve places'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

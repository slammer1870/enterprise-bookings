import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import {
  releaseCheckoutHold,
  CHECKOUT_HOLD_COLLECTION_SLUG,
} from '@repo/bookings-payments'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'

export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

/**
 * POST /api/events/guest-release-hold
 * Body: { timeslotId: number | string, guestEmail: string }
 *
 * Releases an active checkout hold for a guest (no browser session).
 * Used on page exit / refresh / abandoning Continue-to-payment.
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  let body: unknown = null
  if (contentType.includes('application/json')) {
    body = await request.json().catch(() => null)
  } else {
    // sendBeacon sometimes arrives as text/plain
    const text = await request.text().catch(() => '')
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
  }
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

  const guestEmailRaw = (body as { guestEmail?: unknown }).guestEmail
  const guestEmail =
    typeof guestEmailRaw === 'string' ? guestEmailRaw.trim().toLowerCase() : ''
  if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const ip = clientIp(request)
  const ipLimit = checkRateLimit({
    key: `guest-release-hold:ip:${ip}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  })
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const payload = await getPayload()

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: guestEmail } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = existing.docs[0] as { id?: number } | undefined
  if (!user?.id) {
    // Nothing to release — treat as success so page-unload callers stay quiet.
    return NextResponse.json({ released: 0 })
  }

  try {
    const result = await releaseCheckoutHold(payload, {
      timeslotId,
      userId: Number(user.id),
      holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to release checkout hold'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

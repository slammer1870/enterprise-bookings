import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'
import {
  resolveTenantSlugOrId,
  resolveTenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

export const dynamic = 'force-dynamic'

/**
 * Public fee breakdown for event page ticket panel (no auth required).
 * Uses the same platform-fees path as authenticated drop-in checkout.
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const timeslotId =
    typeof body.timeslotId === 'number'
      ? body.timeslotId
      : typeof body.timeslotId === 'string' && /^\d+$/.test(body.timeslotId)
        ? parseInt(body.timeslotId, 10)
        : null
  const classPriceCents =
    typeof body.classPriceCents === 'number' ? body.classPriceCents : null

  if (timeslotId == null || classPriceCents == null || classPriceCents < 0) {
    return NextResponse.json(
      { error: 'timeslotId and classPriceCents are required' },
      { status: 400 },
    )
  }

  const timeslot = (await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 0,
    overrideAccess: true,
  })) as { tenant?: number | { id: number }; active?: boolean | null } | null

  if (!timeslot || timeslot.active === false) {
    return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 })
  }

  const tenantId =
    timeslot.tenant != null
      ? typeof timeslot.tenant === 'object'
        ? timeslot.tenant.id
        : timeslot.tenant
      : null

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 })
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

  const bookingFeeCents = await calculateBookingFeeAmount({
    tenantId,
    productType: 'drop-in',
    classPriceAmount: classPriceCents,
    payload,
  })

  return NextResponse.json({
    classPriceCents,
    bookingFeeCents,
    totalCents: classPriceCents + bookingFeeCents,
  })
}

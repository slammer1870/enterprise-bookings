import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'
import {
  getCurrentUser,
  resolveTenantSlugOrId,
  resolveTenantForConnect,
  type TenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { coerceMetadata } from '@/lib/api/request-utils'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'
import {
  validateBookingIdsFromMetadata,
  reservePendingBookings,
  formatCapacityError,
  computeRemainingCapacityForTimeslot,
} from '@/lib/booking/payment-intent'
import { confirmBookingsFromPaymentIntent } from '@/lib/stripe-connect/webhook/confirm-bookings'
import { formatAmountForStripe } from '@repo/shared-utils'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const user = await getCurrentUser(payload, request)
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const price = typeof body.price === 'number' ? body.price : null
  if (price == null || Number.isNaN(price)) {
    return NextResponse.json({ error: 'Missing price' }, { status: 400 })
  }
  const confirmOnly = body.confirmOnly === true

  const metadata = coerceMetadata(body.metadata)
  const timeslotIdRaw = metadata?.timeslotId
  const timeslotId =
    timeslotIdRaw && /^\d+$/.test(timeslotIdRaw) ? parseInt(timeslotIdRaw, 10) : null
  if (!timeslotId) {
    return NextResponse.json({ error: 'timeslotId is required in metadata' }, { status: 400 })
  }

  const quantity = Math.max(1, parseInt(metadata?.quantity ?? '1', 10) || 1)

  let bookingIds = await validateBookingIdsFromMetadata(payload, metadata ?? {}, {
    timeslotId,
    userId: user.id,
    user,
  })

  const timeslot = (await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 3,
    overrideAccess: true,
  })) as {
    tenant?: number | { id: number }
    remainingCapacity?: number
    eventType?: any
  } | null

  if (!timeslot) {
    return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 })
  }

  const remainingCapacity =
    typeof timeslot.remainingCapacity === 'number'
      ? Math.max(0, timeslot.remainingCapacity)
      : await computeRemainingCapacityForTimeslot(payload, timeslotId, timeslot)

  // Per-viewer cap for drop-in multi-booking (confirmed bookings only).
  // Note: when we confirm existing pending bookings via metadata, cap must still apply.
  const dropInRaw = timeslot?.eventType?.paymentMethods?.allowedDropIn ?? null
  let dropInDoc: any = null
  if (dropInRaw && typeof dropInRaw === 'object') {
    dropInDoc = dropInRaw
  } else if (typeof dropInRaw === 'number') {
    dropInDoc = await payload.findByID({
      collection: 'drop-ins',
      id: dropInRaw,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null)
  }

  const configuredMaxRaw = dropInDoc?.maxBookingsPerTimeslot
  const maxPerViewer =
    dropInDoc == null
      ? 1
      : configuredMaxRaw == null
        ? Infinity
        : Number.isFinite(Number(configuredMaxRaw))
          ? Math.max(1, Number(configuredMaxRaw))
          : Infinity

  const requestedForCap = bookingIds.length > 0 ? bookingIds.length : quantity

  if (maxPerViewer !== Infinity) {
    const existingConfirmedResult = await payload.find({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
      depth: 0,
      limit: 0,
      overrideAccess: true,
      where: {
        and: [
          { timeslot: { equals: timeslotId } },
          { user: { equals: user.id } },
          { status: { equals: 'confirmed' } },
        ],
      },
    })

    const existingConfirmed = existingConfirmedResult.totalDocs ?? 0

    if (existingConfirmed + requestedForCap > maxPerViewer) {
      const remainingForUser = Math.max(0, maxPerViewer - existingConfirmed)
      return NextResponse.json(
        {
          error:
            remainingForUser === 0
              ? 'You already have the maximum confirmed bookings for this timeslot with this payment option.'
              : `You can book up to ${maxPerViewer} confirmed bookings per timeslot with this payment option. You can add ${remainingForUser} more.`,
        },
        { status: 400 },
      )
    }
  }

  const classPriceAmountCents = formatAmountForStripe(price, 'eur')
  // €0 bootstrap (e.g. 100% promo): skip capacity precheck so we can return { zeroAmount } before
  // any heavier checks; confirmOnly still reserves with real capacity.
  const skipCapacityPrecheck = classPriceAmountCents <= 0 && !confirmOnly

  if (bookingIds.length === 0 && quantity > remainingCapacity && !skipCapacityPrecheck) {
    return NextResponse.json(
      { error: formatCapacityError(remainingCapacity, quantity) },
      { status: 400 }
    )
  }

  const tenantId =
    timeslot?.tenant != null
      ? typeof timeslot.tenant === 'object' && timeslot.tenant !== null
        ? timeslot.tenant.id
        : timeslot.tenant
      : null

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context not found for timeslot' }, { status: 400 })
  }

  // Cross-tenant guard: if the request carries a specific tenant context (subdomain or cookie),
  // reject timeslot IDs that belong to a different tenant. This prevents a user on tenant A's
  // site from booking a timeslot that belongs to tenant B by guessing its numeric ID.
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

  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectOnboardingStatus: true,
    } as any,
  })) as TenantForConnect | null

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const placeholderAccount =
    /^acct_[a-z0-9_]+$/.test(tenant.stripeConnectAccountId?.trim() ?? '')
  const isTestMode =
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_TEST_WEBHOOKS === 'true' ||
    isStripeTestAccount(tenant.stripeConnectAccountId) ||
    placeholderAccount

  // €0 flows (bootstrap or confirm-only) never create a PaymentIntent; don't require Connect.
  const needsLiveStripeConnect = classPriceAmountCents > 0 && !isTestMode
  if (
    needsLiveStripeConnect &&
    (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active')
  ) {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  // Even in test mode we reserve pending bookings. Some UI flows (and E2E tests)
  // increase quantity and expect `status: "pending"` bookings to exist before payment
  // is completed (payment confirmation happens later via mock webhooks).
  if (bookingIds.length === 0) {
    try {
      bookingIds = await reservePendingBookings(payload, {
        timeslotId,
        userId: user.id,
        user,
        tenantId,
        quantity,
        trustedServerReservation: true,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Capacity exceeded'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  if (classPriceAmountCents <= 0) {
    if (!confirmOnly) {
      return NextResponse.json({ zeroAmount: true, amount: 0 }, { status: 200 })
    }

    if (bookingIds.length === 0) {
      try {
        bookingIds = await reservePendingBookings(payload, {
          timeslotId,
          userId: user.id,
          user,
          tenantId,
          quantity,
          trustedServerReservation: true,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Capacity exceeded'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    const resolvedBookingIds = bookingIds
      .map((id: string | number) => parseInt(String(id), 10))
      .filter((id: number) => Number.isFinite(id))

    await confirmBookingsFromPaymentIntent(payload, resolvedBookingIds, {
      tenantId,
      tenantContext: { tenant: tenantId },
    })

    return NextResponse.json(
      { zeroAmount: true, amount: 0, bookingIds: resolvedBookingIds },
      { status: 200 }
    )
  }

  if (isTestMode) {
    // Stripe Elements expects a PaymentIntent-style client secret shape in tests too.
    return NextResponse.json(
      { clientSecret: `pi_${Date.now()}_secret_test`, amount: price },
      { status: 200 }
    )
  }

  try {
    const userName = typeof user?.name === 'string' ? user.name : null
    const { stripeCustomerId } = await ensureStripeCustomerIdForAccount({
      payload,
      userId: user.id,
      email: user.email,
      name: userName,
      stripeAccountId: tenant.stripeConnectAccountId,
    })

    const { client_secret } = await createTenantPaymentIntent({
      tenant: {
        id: tenant.id,
        stripeConnectAccountId: tenant.stripeConnectAccountId,
        stripeConnectOnboardingStatus: tenant.stripeConnectOnboardingStatus,
      },
      classPriceAmount: classPriceAmountCents,
      currency: 'eur',
      productType: 'drop-in',
      payload,
      customerId: stripeCustomerId,
      receiptEmail: user.email,
      metadata: {
        ...(metadata ?? {}),
        timeslotId: String(timeslotId),
        userId: String(user.id),
        quantity: String(quantity),
        ...(bookingIds.length > 0 ? { bookingIds: bookingIds.join(',') } : {}),
      },
    })

    return NextResponse.json(
      { clientSecret: client_secret, amount: price, stripeAccountId: tenant.stripeConnectAccountId },
      { status: 200 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

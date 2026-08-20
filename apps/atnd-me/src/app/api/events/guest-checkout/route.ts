import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { ensureGuestUser } from '@/lib/booking/ensureGuestUser'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'
import {
  resolveTenantSlugOrId,
  resolveTenantForConnect,
  type TenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { coerceMetadata } from '@/lib/api/request-utils'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'
import {
  upsertCheckoutHold,
  releaseCheckoutHold,
  computeRemainingCapacityWithHolds,
  CHECKOUT_HOLD_COLLECTION_SLUG,
} from '@repo/bookings-payments'
import { formatCapacityError } from '@/lib/booking/payment-intent'
import { formatAmountForStripe } from '@repo/shared-utils'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'

export const dynamic = 'force-dynamic'

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const price = typeof body.price === 'number' ? body.price : null
  if (price == null || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: 'Missing price' }, { status: 400 })
  }

  const metadata = coerceMetadata(body.metadata)
  const timeslotIdRaw = metadata?.timeslotId
  const timeslotId =
    timeslotIdRaw && /^\d+$/.test(timeslotIdRaw) ? parseInt(timeslotIdRaw, 10) : null
  if (!timeslotId) {
    return NextResponse.json({ error: 'timeslotId is required in metadata' }, { status: 400 })
  }

  const guestName =
    typeof metadata?.guestName === 'string'
      ? metadata.guestName.trim()
      : typeof body.guestName === 'string'
        ? body.guestName.trim()
        : ''
  const guestEmailRaw =
    typeof metadata?.guestEmail === 'string'
      ? metadata.guestEmail
      : typeof body.guestEmail === 'string'
        ? body.guestEmail
        : ''
  const guestEmail = guestEmailRaw.trim().toLowerCase()

  if (!guestName || guestName.length < 2) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  // Reject partial addresses like `sam@` / `sam@ex` — each would create a distinct
  // guest user + checkout hold and exhaust capacity while the user is still typing.
  if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const ip = clientIp(request)
  const ipLimit = checkRateLimit({
    key: `guest-checkout:ip:${ip}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  const emailLimit = checkRateLimit({
    key: `guest-checkout:email:${guestEmail}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!emailLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const quantity = Math.max(1, parseInt(metadata?.quantity ?? '1', 10) || 1)
  const checkoutSessionId =
    typeof metadata?.checkoutSessionId === 'string' && metadata.checkoutSessionId.trim()
      ? metadata.checkoutSessionId.trim()
      : null

  const timeslot = (await payload.findByID({
    collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    id: timeslotId,
    depth: 3,
    overrideAccess: true,
  })) as {
    id?: number
    active?: boolean | null
    tenant?: number | { id: number }
    eventType?: {
      paymentMethods?: {
        allowedDropIn?: number | { id?: number; price?: number; maxBookingsPerTimeslot?: number | null } | null
      } | null
    } | null
  } | null

  if (!timeslot || timeslot.active === false) {
    return NextResponse.json({ error: 'Timeslot not found' }, { status: 404 })
  }

  const dropInRaw = timeslot.eventType?.paymentMethods?.allowedDropIn ?? null
  if (!dropInRaw) {
    return NextResponse.json(
      { error: 'This event does not support guest drop-in purchase.' },
      { status: 400 },
    )
  }

  let dropInDoc: { id?: number; price?: number; maxBookingsPerTimeslot?: number | null } | null =
    typeof dropInRaw === 'object' ? dropInRaw : null
  if (typeof dropInRaw === 'number') {
    dropInDoc = (await payload
      .findByID({
        collection: 'drop-ins',
        id: dropInRaw,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)) as typeof dropInDoc
  }

  if (!dropInDoc || typeof dropInDoc.price !== 'number') {
    return NextResponse.json({ error: 'Drop-in price is not configured for this event.' }, { status: 400 })
  }

  const configuredMaxRaw = dropInDoc.maxBookingsPerTimeslot
  const maxPerViewer =
    configuredMaxRaw == null
      ? Infinity
      : Number.isFinite(Number(configuredMaxRaw))
        ? Math.max(1, Number(configuredMaxRaw))
        : Infinity

  if (maxPerViewer !== Infinity && quantity > maxPerViewer) {
    return NextResponse.json(
      {
        error: `You can book up to ${maxPerViewer} place${maxPerViewer !== 1 ? 's' : ''} per purchase.`,
      },
      { status: 400 },
    )
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

  if (maxPerViewer !== Infinity) {
    const existingConfirmedResult = await payload.find({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
      depth: 0,
      limit: 0,
      overrideAccess: true,
      where: {
        and: [
          { timeslot: { equals: timeslotId } },
          { user: { equals: guest.userId } },
          { status: { equals: 'confirmed' } },
        ],
      },
    })
    const existingConfirmed = existingConfirmedResult.totalDocs ?? 0
    if (existingConfirmed + quantity > maxPerViewer) {
      const remainingForUser = Math.max(0, maxPerViewer - existingConfirmed)
      return NextResponse.json(
        {
          error:
            remainingForUser === 0
              ? 'You already have the maximum confirmed bookings for this timeslot.'
              : `You can book up to ${maxPerViewer} confirmed bookings. You can add ${remainingForUser} more.`,
        },
        { status: 400 },
      )
    }
  }

  let hold: { holdId: number; quantity: number }
  try {
    const upserted = await upsertCheckoutHold(payload, {
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
    if (upserted.abandoned) {
      return NextResponse.json(
        { error: 'Checkout was cancelled. Please start again.' },
        { status: 409 },
      )
    }
    hold = { holdId: upserted.holdId, quantity: upserted.quantity }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unable to reserve places'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const remainingCapacity = await computeRemainingCapacityWithHolds(payload, timeslotId, {
    timeslotsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    eventTypesSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    bookingsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
  })
  const capacityForPrecheck = remainingCapacity + hold.quantity
  if (quantity > capacityForPrecheck) {
    return NextResponse.json(
      { error: formatCapacityError(capacityForPrecheck, quantity) },
      { status: 400 },
    )
  }

  const classPriceAmountCents = formatAmountForStripe(price, 'eur')

  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      stripeConnectAccountId: true,
      stripeConnectOnboardingStatus: true,
    } as Record<string, true>,
  })) as TenantForConnect | null

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const placeholderAccount = /^acct_[a-z0-9_]+$/.test(tenant.stripeConnectAccountId?.trim() ?? '')
  const isTestMode =
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_TEST_WEBHOOKS === 'true' ||
    isStripeTestAccount(tenant.stripeConnectAccountId) ||
    placeholderAccount

  if (classPriceAmountCents <= 0) {
    return NextResponse.json({ error: 'Guest checkout requires a paid drop-in price.' }, { status: 400 })
  }

  if (
    !isTestMode &&
    (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active')
  ) {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  if (isTestMode) {
    // Must match CheckoutForm's `pi_test_.*_secret_test` mock pattern so Stripe Elements
    // is not bootstrapped with an invalid PaymentIntent client secret.
    const mockId = `pi_test_${Date.now()}`
    return NextResponse.json(
      {
        clientSecret: `${mockId}_secret_test`,
        amount: price,
        holdId: hold.holdId,
        stripeAccountId: tenant.stripeConnectAccountId,
      },
      { status: 200 },
    )
  }

  try {
    const { stripeCustomerId } = await ensureStripeCustomerIdForAccount({
      payload,
      userId: guest.userId,
      email: guest.email,
      name: guest.name,
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
      receiptEmail: guest.email,
      metadata: {
        timeslotId: String(timeslotId),
        userId: String(guest.userId),
        quantity: String(quantity),
        holdId: String(hold.holdId),
        guestCheckout: 'true',
        guestEmail: guest.email,
        guestName: guest.name,
      },
    })

    return NextResponse.json(
      {
        clientSecret: client_secret,
        amount: price,
        holdId: hold.holdId,
        stripeAccountId: tenant.stripeConnectAccountId,
      },
      { status: 200 },
    )
  } catch (e) {
    await releaseCheckoutHold(payload, {
      timeslotId,
      userId: guest.userId,
      holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
    }).catch(() => {})
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

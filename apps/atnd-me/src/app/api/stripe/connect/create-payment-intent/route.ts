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
  getActiveCheckoutHold,
  fulfillCheckoutHold,
  computeRemainingCapacityWithHolds,
  CHECKOUT_HOLD_COLLECTION_SLUG,
} from '@repo/bookings-payments'
import {
  formatCapacityError,
} from '@/lib/booking/payment-intent'
import { formatAmountForStripe } from '@repo/shared-utils'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const payload = await getPayload()

  // Context bucket populated as the handler progresses — included in alert emails.
  const _alertTo = process.env.ALERT_EMAIL || 'info@atnd.ie'
  let _alertUserId: number | undefined
  let _alertTenantId: number | null = null
  let _alertTimeslotId: number | null = null
  let _alertPrice: number | null = null

  /**
   * Replaces direct NextResponse.json calls for non-200 responses.
   * Fires a fire-and-forget alert email for any status that is not 200.
   */
  function alertResponse<T extends object>(
    data: T,
    status: number,
    extra?: { stack?: string },
  ): NextResponse {
    if (status !== 200) {
      const occurredAt = new Date().toISOString()
      const errorMsg = 'error' in data ? String((data as any).error) : JSON.stringify(data)

      // Always write to server logs so failures are visible even when email is down.
      console.error(
        `[create-payment-intent] ${status} at ${occurredAt}`,
        {
          error: errorMsg,
          userId: _alertUserId,
          tenantId: _alertTenantId,
          timeslotId: _alertTimeslotId,
          price: _alertPrice,
        },
        extra?.stack ?? '',
      )

      payload
        .sendEmail({
          to: _alertTo,
          subject: `[ATND] create-payment-intent ${status} – ${errorMsg.slice(0, 80)}`,
          html: `
            <p>A <strong>create-payment-intent</strong> request returned <strong>${status}</strong>.</p>
            <table cellpadding="6" style="border-collapse:collapse;font-family:monospace;font-size:13px">
              <tr><td><strong>Time</strong></td><td>${occurredAt}</td></tr>
              <tr><td><strong>Status</strong></td><td>${status}</td></tr>
              ${_alertUserId != null ? `<tr><td><strong>User ID</strong></td><td>${_alertUserId}</td></tr>` : ''}
              ${_alertTenantId != null ? `<tr><td><strong>Tenant ID</strong></td><td>${_alertTenantId}</td></tr>` : ''}
              ${_alertTimeslotId != null ? `<tr><td><strong>Timeslot ID</strong></td><td>${_alertTimeslotId}</td></tr>` : ''}
              ${_alertPrice != null ? `<tr><td><strong>Price (cents)</strong></td><td>${_alertPrice}</td></tr>` : ''}
              <tr><td><strong>Error</strong></td><td style="color:#b00">${errorMsg}</td></tr>
            </table>
            ${extra?.stack ? `<pre style="background:#f4f4f4;padding:12px;margin-top:12px;font-size:12px;overflow:auto">${extra.stack}</pre>` : ''}
          `,
        })
        .catch((emailErr) => {
          console.error('[create-payment-intent] alert email failed:', emailErr)
        })
    }
    return NextResponse.json(data, { status })
  }

  const user = await getCurrentUser(payload, request)
  if (!user?.id) {
    return alertResponse({ error: 'Unauthorized' }, 401)
  }
  _alertUserId = user.id

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return alertResponse({ error: 'Invalid JSON body' }, 400)
  }

  const price = typeof body.price === 'number' ? body.price : null
  if (price == null || Number.isNaN(price)) {
    return alertResponse({ error: 'Missing price' }, 400)
  }
  _alertPrice = price
  const confirmOnly = body.confirmOnly === true

  const metadata = coerceMetadata(body.metadata)
  const timeslotIdRaw = metadata?.timeslotId
  const timeslotId =
    timeslotIdRaw && /^\d+$/.test(timeslotIdRaw) ? parseInt(timeslotIdRaw, 10) : null
  if (!timeslotId) {
    return alertResponse({ error: 'timeslotId is required in metadata' }, 400)
  }
  _alertTimeslotId = timeslotId

  const quantity = Math.max(1, parseInt(metadata?.quantity ?? '1', 10) || 1)

  let holdId: number | null = null
  // Track the hold's reserved quantity so the capacity precheck can exclude it.
  // computeRemainingCapacityWithHolds counts every active hold (including the
  // requester's own) against remaining capacity.  Since the hold IS the
  // authorisation for this payment we must add it back when comparing, otherwise
  // the check incorrectly fires when the hold fills the last N slots exactly.
  let ownHoldQuantity = 0
  const holdIdRaw = metadata?.holdId
  if (holdIdRaw && /^\d+$/.test(holdIdRaw)) {
    holdId = parseInt(holdIdRaw, 10)
    const holdRecord = await payload
      .findByID({
        collection: CHECKOUT_HOLD_COLLECTION_SLUG,
        id: holdId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null) as { id?: number; quantity?: number } | null
    ownHoldQuantity = holdRecord?.quantity ?? 0
  } else {
    const active = await getActiveCheckoutHold(payload, {
      timeslotId,
      userId: user.id,
    })
    holdId = active?.id ?? null
    ownHoldQuantity = active?.quantity ?? 0
  }
  if (holdId == null) {
    return alertResponse(
      { error: 'Checkout hold required. Reserve capacity before creating payment intent.' },
      400,
    )
  }

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
    return alertResponse({ error: 'Timeslot not found' }, 404)
  }

  const remainingCapacity = await computeRemainingCapacityWithHolds(payload, timeslotId, {
    timeslotsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
    eventTypesSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
    bookingsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    holdCollection: CHECKOUT_HOLD_COLLECTION_SLUG,
  })

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

  const requestedForCap = quantity

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
      return alertResponse(
        {
          error:
            remainingForUser === 0
              ? 'You already have the maximum confirmed bookings for this timeslot with this payment option.'
              : `You can book up to ${maxPerViewer} confirmed bookings per timeslot with this payment option. You can add ${remainingForUser} more.`,
        },
        400,
      )
    }
  }

  const classPriceAmountCents = formatAmountForStripe(price, 'eur')
  _alertPrice = classPriceAmountCents
  // €0 bootstrap (e.g. 100% promo): skip capacity precheck so we can return { zeroAmount } before
  // any heavier checks; confirmOnly still reserves with real capacity.
  const skipCapacityPrecheck = classPriceAmountCents <= 0 && !confirmOnly

  // computeRemainingCapacityWithHolds includes the current user's own hold in its
  // "held" tally, so when their hold fills the last N slots the raw remaining reads 0.
  // Adding ownHoldQuantity back gives the capacity available to THIS user (their hold
  // is the reservation they are paying for, not competing capacity).
  const capacityForPrecheck = remainingCapacity + ownHoldQuantity
  if (quantity > capacityForPrecheck && !skipCapacityPrecheck) {
    return alertResponse(
      { error: formatCapacityError(capacityForPrecheck, quantity) },
      400,
    )
  }

  const tenantId =
    timeslot?.tenant != null
      ? typeof timeslot.tenant === 'object' && timeslot.tenant !== null
        ? timeslot.tenant.id
        : timeslot.tenant
      : null

  if (!tenantId) {
    return alertResponse({ error: 'Tenant context not found for timeslot' }, 400)
  }
  _alertTenantId = tenantId

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
        return alertResponse({ error: 'Timeslot not found' }, 404)
      }
    } else {
      const requestTenant = await resolveTenantForConnect(payload, requestTenantSlugOrId)
      if (requestTenant != null && requestTenant.id !== tenantId) {
        return alertResponse({ error: 'Timeslot not found' }, 404)
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
    return alertResponse({ error: 'Tenant not found' }, 404)
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
    return alertResponse({ error: 'Tenant is not connected to Stripe' }, 400)
  }

  if (classPriceAmountCents <= 0) {
    if (!confirmOnly) {
      return NextResponse.json({ zeroAmount: true, amount: 0 }, { status: 200 })
    }

    const result = await fulfillCheckoutHold(payload, {
      holdId,
      userId: user.id,
      tenantId,
      tenantContext: { tenant: tenantId },
      timeslotsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      eventTypesSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.eventTypes,
      bookingsSlug: ATND_ME_BOOKINGS_COLLECTION_SLUGS.bookings,
    })

    return NextResponse.json(
      {
        zeroAmount: true,
        amount: 0,
        bookingIds: result.confirmedBookingIds,
        refunded: result.refunded,
      },
      { status: 200 },
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
        holdId: String(holdId),
      },
    })

    return NextResponse.json(
      { clientSecret: client_secret, amount: price, stripeAccountId: tenant.stripeConnectAccountId },
      { status: 200 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    const stack = e instanceof Error && e.stack ? e.stack : message
    return alertResponse({ error: message }, 500, { stack })
  }
}

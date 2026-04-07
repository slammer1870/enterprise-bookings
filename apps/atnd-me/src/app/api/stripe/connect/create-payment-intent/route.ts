import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'
import {
  getCurrentUser,
  type TenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { coerceMetadata } from '@/lib/api/request-utils'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'
import {
  validateBookingIdsFromMetadata,
  reservePendingBookings,
  formatCapacityError,
} from '@/lib/booking/payment-intent'
import { formatAmountForStripe } from '@repo/shared-utils'

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

  const metadata = coerceMetadata(body.metadata)
  const lessonIdRaw = metadata?.lessonId
  const lessonId =
    lessonIdRaw && /^\d+$/.test(lessonIdRaw) ? parseInt(lessonIdRaw, 10) : null
  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId is required in metadata' }, { status: 400 })
  }

  const quantity = Math.max(1, parseInt(metadata?.quantity ?? '1', 10) || 1)

  let bookingIds = await validateBookingIdsFromMetadata(payload, metadata ?? {}, {
    lessonId,
    userId: user.id,
    user,
  })

  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
    overrideAccess: true,
  })) as { tenant?: number | { id: number }; remainingCapacity?: number } | null

  const remainingCapacity =
    lesson && typeof lesson.remainingCapacity === 'number'
      ? Math.max(0, lesson.remainingCapacity)
      : 0

  if (bookingIds.length === 0 && quantity > remainingCapacity) {
    return NextResponse.json(
      { error: formatCapacityError(remainingCapacity, quantity) },
      { status: 400 }
    )
  }

  const tenantId =
    lesson?.tenant != null
      ? typeof lesson.tenant === 'object' && lesson.tenant !== null
        ? lesson.tenant.id
        : lesson.tenant
      : null

  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context not found for lesson' }, { status: 400 })
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

  if (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  const placeholderAccount =
    /^acct_[a-z0-9_]+$/.test(tenant.stripeConnectAccountId?.trim() ?? '')
  const isTestMode =
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_TEST_WEBHOOKS === 'true' ||
    isStripeTestAccount(tenant.stripeConnectAccountId) ||
    placeholderAccount

  if (bookingIds.length === 0 && !isTestMode) {
    try {
      bookingIds = await reservePendingBookings(payload, {
        lessonId,
        userId: user.id,
        user,
        tenantId,
        quantity,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Capacity exceeded'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
  }

  const classPriceAmountCents = formatAmountForStripe(price, 'eur')

  if (isTestMode) {
    return NextResponse.json(
      { clientSecret: `pi_test_${Date.now()}_secret_test`, amount: price },
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
      metadata: {
        ...(metadata ?? {}),
        lessonId: String(lessonId),
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

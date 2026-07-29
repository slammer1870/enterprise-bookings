/**
 * Guest course checkout: ensureGuestUser + PaymentIntent for course enrollment.
 * No timeslot hold — capacity checked at intent + webhook time.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { ensureGuestUser } from '@/lib/booking/ensureGuestUser'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'
import {
  resolveTenantSlugOrId,
  resolveTenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'
import {
  isCompleteGuestEmail,
  resolveCourseForPurchase,
  type CourseForPurchase,
} from '@/lib/courses/resolve-course-for-purchase'

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

  const metadata =
    body.metadata && typeof body.metadata === 'object'
      ? (body.metadata as Record<string, unknown>)
      : null
  const courseIdRaw = body.courseId ?? metadata?.courseId
  const courseId =
    typeof courseIdRaw === 'number'
      ? courseIdRaw
      : typeof courseIdRaw === 'string'
        ? parseInt(courseIdRaw, 10)
        : undefined
  if (courseId == null || !Number.isFinite(courseId) || courseId < 1) {
    return NextResponse.json(
      { error: 'courseId required and must be a positive integer' },
      { status: 400 },
    )
  }

  const guestNameRaw =
    typeof metadata?.guestName === 'string'
      ? metadata.guestName
      : typeof body.guestName === 'string'
        ? body.guestName
        : ''
  const guestEmailRaw =
    typeof metadata?.guestEmail === 'string'
      ? metadata.guestEmail
      : typeof body.guestEmail === 'string'
        ? body.guestEmail
        : ''
  const guestName = guestNameRaw.trim()
  const guestEmail = guestEmailRaw.trim().toLowerCase()

  if (!guestName || guestName.length < 2) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!isCompleteGuestEmail(guestEmail)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const ip = clientIp(request)
  const ipLimit = checkRateLimit({
    key: `course-guest-checkout:ip:${ip}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  })
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
  }
  const emailLimit = checkRateLimit({
    key: `course-guest-checkout:email:${guestEmail}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
  }

  const tenantSlugOrId = resolveTenantSlugOrId(request)
  if (!tenantSlugOrId) {
    return NextResponse.json(
      { error: 'Tenant context required (x-tenant-slug / x-tenant-id / tenant-slug cookie)' },
      { status: 400 },
    )
  }

  const tenant = await resolveTenantForConnect(payload, String(tenantSlugOrId))
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  if (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  const course = (await payload
    .findByID({
      collection: 'courses' as import('payload').CollectionSlug,
      id: courseId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)) as CourseForPurchase | null

  const activeCount = await payload.find({
    collection: 'course-enrollments' as import('payload').CollectionSlug,
    where: {
      and: [
        { course: { equals: courseId } },
        { tenant: { equals: tenant.id } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  const resolved = resolveCourseForPurchase({
    course,
    expectedTenantId: tenant.id,
    activeEnrollmentCount: activeCount.totalDocs ?? 0,
  })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const guest = await ensureGuestUser({
    payload,
    email: guestEmail,
    name: guestName,
    tenantId: tenant.id,
  })

  const placeholderAccount = /^acct_[a-z0-9_]+$/.test(
    tenant.stripeConnectAccountId?.trim() ?? '',
  )
  if (isStripeTestAccount(tenant.stripeConnectAccountId) || placeholderAccount) {
    const mockId = `pi_test_${Date.now()}`
    return NextResponse.json({
      clientSecret: `${mockId}_secret_test`,
      stripeAccountId: tenant.stripeConnectAccountId,
    })
  }

  try {
    const { stripeCustomerId } = await ensureStripeCustomerIdForAccount({
      payload,
      userId: guest.userId,
      email: guestEmail,
      name: guestName,
      stripeAccountId: tenant.stripeConnectAccountId,
    })

    const { client_secret } = await createTenantPaymentIntent({
      tenant: {
        id: tenant.id,
        stripeConnectAccountId: tenant.stripeConnectAccountId,
        stripeConnectOnboardingStatus: tenant.stripeConnectOnboardingStatus,
      },
      classPriceAmount: resolved.priceCents,
      currency: 'eur',
      productType: 'course',
      payload,
      customerId: stripeCustomerId,
      metadata: {
        type: 'course_purchase',
        userId: String(guest.userId),
        tenantId: String(tenant.id),
        courseId: String(courseId),
        guestCheckout: 'true',
      },
    })

    return NextResponse.json({
      clientSecret: client_secret,
      stripeAccountId: tenant.stripeConnectAccountId,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

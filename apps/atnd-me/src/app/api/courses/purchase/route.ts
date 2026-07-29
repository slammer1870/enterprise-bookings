/**
 * Authenticated course purchase: create PaymentIntent for course enrollment.
 * Tenant from context (slug/header). Enrollment is created by webhook on payment success.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'
import {
  getCurrentUser,
  resolveTenantSlugOrId,
  resolveTenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'
import {
  resolveCourseForPurchase,
  type CourseForPurchase,
} from '@/lib/courses/resolve-course-for-purchase'

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
      classPriceAmount: resolved.priceCents,
      currency: 'eur',
      productType: 'course',
      payload,
      customerId: stripeCustomerId,
      metadata: {
        type: 'course_purchase',
        userId: String(user.id),
        tenantId: String(tenant.id),
        courseId: String(courseId),
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

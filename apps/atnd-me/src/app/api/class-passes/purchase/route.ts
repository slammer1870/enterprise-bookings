/**
 * Class pass purchase: create PaymentIntent for class pass.
 * Accepts quantity and classPassTypeId; tenant from context (slug/header).
 * Pass expiry after payment is set from the class pass type's daysUntilExpiration (webhook), not client input.
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

  const quantity = typeof body.quantity === 'number' ? body.quantity : undefined
  if (quantity == null || quantity < 1) {
    return NextResponse.json(
      { error: 'quantity required and must be at least 1' },
      { status: 400 }
    )
  }

  const classPassTypeId =
    typeof body.classPassTypeId === 'number'
      ? body.classPassTypeId
      : typeof body.classPassTypeId === 'string'
        ? parseInt(body.classPassTypeId, 10)
        : undefined
  if (classPassTypeId == null || !Number.isFinite(classPassTypeId) || classPassTypeId < 1) {
    return NextResponse.json(
      { error: 'classPassTypeId required and must be a positive integer' },
      { status: 400 }
    )
  }

  const tenantSlugOrId = resolveTenantSlugOrId(request)
  if (!tenantSlugOrId) {
    return NextResponse.json(
      { error: 'Tenant context required (x-tenant-slug / x-tenant-id / tenant-slug cookie)' },
      { status: 400 }
    )
  }

  const tenant = await resolveTenantForConnect(payload, String(tenantSlugOrId))
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  if (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  const classPassType = await payload
    .findByID({
      collection: 'class-pass-types' as import('payload').CollectionSlug,
      id: classPassTypeId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null) as { priceInformation?: { price?: number } } | null

  const priceEur = classPassType?.priceInformation?.price
  if (priceEur == null || priceEur <= 0) {
    return NextResponse.json({ error: 'Class pass type has no price configured' }, { status: 400 })
  }

  const unitCents = Math.round(priceEur * 100)
  const totalCents = unitCents * quantity

  const placeholderAccount =
    /^acct_[a-z0-9_]+$/.test(tenant.stripeConnectAccountId?.trim() ?? '')
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
      classPriceAmount: totalCents,
      currency: 'eur',
      productType: 'class-pass',
      payload,
      customerId: stripeCustomerId,
      metadata: {
        type: 'class_pass_purchase',
        userId: String(user.id),
        tenantId: String(tenant.id),
        classPassTypeId: String(classPassTypeId),
        quantity: String(quantity),
      },
    })
    return NextResponse.json({ clientSecret: client_secret, stripeAccountId: tenant.stripeConnectAccountId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

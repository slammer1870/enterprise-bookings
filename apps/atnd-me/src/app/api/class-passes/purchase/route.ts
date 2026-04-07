/**
 * Class pass purchase: create PaymentIntent for class pass.
 * Accepts quantity, optional expirationDays; tenant from context (slug/header).
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

const DEFAULT_PRICE_CENTS = 1000
const DEFAULT_EXPIRATION_DAYS = 365

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

  const expirationDays =
    typeof body.expirationDays === 'number' ? body.expirationDays : DEFAULT_EXPIRATION_DAYS
  const totalCents = DEFAULT_PRICE_CENTS * quantity

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
        quantity: String(quantity),
        expirationDays: String(expirationDays),
        totalCents: String(totalCents),
      },
    })
    return NextResponse.json({ clientSecret: client_secret, stripeAccountId: tenant.stripeConnectAccountId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

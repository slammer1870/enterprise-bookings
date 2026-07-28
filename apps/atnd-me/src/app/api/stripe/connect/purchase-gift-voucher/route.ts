/**
 * Gift voucher purchase: create PaymentIntent for a custom amount.
 * Auth optional — guests must provide name + email; logged-in users use session identity.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import {
  getCurrentUser,
  resolveTenantSlugOrId,
  resolveTenantForConnect,
} from '@/lib/stripe-connect/api-helpers'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import {
  createGiftVoucherPaymentIntent,
  validateGiftVoucherAmount,
  GIFT_VOUCHER_MIN_EUROS,
  GIFT_VOUCHER_MAX_EUROS,
} from '@/lib/stripe-connect/createGiftVoucherPaymentIntent'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const user = await getCurrentUser(payload, request)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const amountRaw = (body as { amount?: unknown }).amount
  const amount =
    typeof amountRaw === 'number'
      ? amountRaw
      : typeof amountRaw === 'string'
        ? Number(amountRaw)
        : NaN

  if (!validateGiftVoucherAmount(amount)) {
    return NextResponse.json(
      {
        error: `amount must be between ${GIFT_VOUCHER_MIN_EUROS} and ${GIFT_VOUCHER_MAX_EUROS} with at most 2 decimal places`,
      },
      { status: 400 },
    )
  }

  let purchaserEmail: string
  let purchaserName: string
  let userId: number | null = null

  if (user?.id && typeof user.email === 'string' && user.email.trim()) {
    purchaserEmail = user.email.trim()
    purchaserName =
      typeof user.name === 'string' && user.name.trim()
        ? user.name.trim()
        : purchaserEmail.split('@')[0] || 'Customer'
    userId = typeof user.id === 'number' ? user.id : Number(user.id)
    if (!Number.isFinite(userId) || userId <= 0) userId = null
  } else {
    const name =
      typeof (body as { name?: unknown }).name === 'string'
        ? (body as { name: string }).name.trim()
        : ''
    const email =
      typeof (body as { email?: unknown }).email === 'string'
        ? (body as { email: string }).email.trim()
        : ''
    if (!name) {
      return NextResponse.json({ error: 'name is required when not logged in' }, { status: 400 })
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'a valid email is required when not logged in' },
        { status: 400 },
      )
    }
    purchaserName = name
    purchaserEmail = email
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

  const placeholderAccount = /^acct_[a-z0-9_]+$/.test(
    tenant.stripeConnectAccountId?.trim() ?? '',
  )
  if (isStripeTestAccount(tenant.stripeConnectAccountId) || placeholderAccount) {
    const mockId = `pi_test_${Date.now()}`
    return NextResponse.json({
      clientSecret: `${mockId}_secret_test`,
      stripeAccountId: tenant.stripeConnectAccountId,
      amount,
    })
  }

  try {
    let customerId: string | null = null
    if (userId != null) {
      const ensured = await ensureStripeCustomerIdForAccount({
        payload,
        userId,
        email: purchaserEmail,
        name: purchaserName,
        stripeAccountId: tenant.stripeConnectAccountId,
      })
      customerId = ensured.stripeCustomerId
    }

    const { client_secret } = await createGiftVoucherPaymentIntent({
      tenant: {
        id: tenant.id,
        stripeConnectAccountId: tenant.stripeConnectAccountId,
        stripeConnectOnboardingStatus: tenant.stripeConnectOnboardingStatus,
      },
      amountEuros: amount,
      currency: 'eur',
      purchaserEmail,
      purchaserName,
      userId,
      customerId,
    })

    return NextResponse.json({
      clientSecret: client_secret,
      stripeAccountId: tenant.stripeConnectAccountId,
      amount,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

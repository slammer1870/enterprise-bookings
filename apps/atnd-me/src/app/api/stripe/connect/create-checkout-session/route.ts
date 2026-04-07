import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import {
  createTenantCheckoutSession,
} from '@/lib/stripe-connect/charges'
import { calculateBookingFeeAmount } from '@/lib/stripe-connect/bookingFee'
import {
  getCurrentUser,
  resolveTenantForConnect,
  resolveTenantSlugOrId,
} from '@/lib/stripe-connect/api-helpers'
import { getPlatformStripe } from '@/lib/stripe/platform'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'
import { resolveTenantPromotionCodeId } from '@/lib/stripe-connect/discountCodes'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'

type CheckoutSessionBody = {
  priceId?: string
  quantity?: number
  metadata?: Record<string, unknown>
  discountCode?: string
  promotionCodeId?: string
  successUrl?: string
  cancelUrl?: string
  mode?: 'subscription' | 'payment'
}

function normalizeMetadata(rawMetadata: unknown): Record<string, string> | undefined {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(rawMetadata as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, value]) => [key, value.trim()]),
  )
}

function findExactApplicationFeePercent(params: {
  feeCents: number
  totalCents: number
}): number | null {
  const { feeCents, totalCents } = params
  if (!Number.isFinite(feeCents) || !Number.isFinite(totalCents)) return null
  if (feeCents <= 0 || totalCents <= 0) return null

  const twoTotal = 2 * totalCents
  const bpMin = Math.ceil((2 * feeCents - 1) * 10000 / twoTotal)
  const bpMax = Math.floor(((2 * feeCents + 1) * 10000 - 1) / twoTotal)
  if (bpMin > bpMax) return null

  const rounded = Math.round((feeCents / totalCents) * 10000)
  const candidate = Math.min(bpMax, Math.max(bpMin, rounded))
  const computed = Math.round((totalCents * candidate) / 10000)
  if (computed !== feeCents) return null
  return candidate / 100
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const user = await getCurrentUser(payload, request)
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId =
    typeof user.id === 'number'
      ? user.id
      : typeof user.id === 'string'
        ? parseInt(user.id, 10)
        : NaN
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as CheckoutSessionBody | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const priceId = typeof body.priceId === 'string' ? body.priceId.trim() : ''
  if (!priceId) {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
  }

  const mode =
    body.mode === 'payment' || body.mode === 'subscription'
      ? body.mode
      : 'subscription'

  const metadataFromBody = normalizeMetadata(body.metadata)
  const tenantIdentifier =
    typeof metadataFromBody?.tenantId === 'string' && metadataFromBody.tenantId.trim().length > 0
      ? metadataFromBody.tenantId
      : resolveTenantSlugOrId(request)
  if (!tenantIdentifier) {
    return NextResponse.json(
      { error: 'Tenant context required (x-tenant-slug / x-tenant-id / tenant-slug cookie / metadata.tenantId)' },
      { status: 400 },
    )
  }

  const tenant = await resolveTenantForConnect(payload, tenantIdentifier)
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found or not stripe-connected' }, { status: 404 })
  }

  if (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  const tenantId = tenant.id
  if (!Number.isFinite(tenantId) || tenantId <= 0) {
    return NextResponse.json({ error: 'Invalid tenant id' }, { status: 400 })
  }

  let promotionCodeId =
    typeof body.promotionCodeId === 'string' && body.promotionCodeId.trim().length > 0
      ? body.promotionCodeId.trim()
      : undefined

  if (!promotionCodeId && typeof body.discountCode === 'string' && body.discountCode.trim().length > 0) {
    promotionCodeId = await resolveTenantPromotionCodeId(payload, tenantId, body.discountCode)
    if (!promotionCodeId) {
      return NextResponse.json({ error: 'Invalid or inactive discount code.' }, { status: 400 })
    }
  }

  const userName = typeof user.name === 'string' ? user.name : null

  let customerId: string
  try {
    const result = await ensureStripeCustomerIdForAccount({
      payload,
      userId,
      email: user.email,
      name: userName,
      stripeAccountId: tenant.stripeConnectAccountId,
    })
    customerId = result.stripeCustomerId
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unable to resolve tenant customer'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const metadata = {
    ...metadataFromBody,
    tenantId: String(tenant.id),
    ...(metadataFromBody?.type === 'class_pass_purchase' ? { userId: String(userId) } : {}),
  }

  const quantity = typeof body.quantity === 'number' && Number.isFinite(body.quantity) && body.quantity > 0 ? body.quantity : 1
  let subscriptionApplicationFeePercent: number | undefined
  let bookingFeeAmount: number | undefined

  const isTestShortcut = process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_WEBHOOKS === 'true'
  const isTestConnectAccount = isStripeTestAccount(tenant.stripeConnectAccountId)
  if (
    mode === 'subscription' &&
    !isTestShortcut &&
    !isTestConnectAccount &&
    typeof tenant.id === 'number' &&
    payload
  ) {
    const stripe = getPlatformStripe()
    const stripeOpts = { stripeAccount: tenant.stripeConnectAccountId }
    const priceObj = await stripe.prices.retrieve(priceId, { expand: [] }, stripeOpts)
    const unitAmount = typeof priceObj.unit_amount === 'number' ? priceObj.unit_amount : 0
    const recurring = priceObj.recurring
    const classPriceAmount = unitAmount * quantity
    if (classPriceAmount > 0 && recurring) {
      bookingFeeAmount = await calculateBookingFeeAmount({
        payload,
        tenantId: tenant.id,
        productType: 'subscription',
        classPriceAmount,
      })
      if (bookingFeeAmount > 0) {
        const totalCents = classPriceAmount + bookingFeeAmount
        const exactPct = findExactApplicationFeePercent({
          feeCents: bookingFeeAmount,
          totalCents,
        })
        if (exactPct != null && exactPct > 0) {
          subscriptionApplicationFeePercent = exactPct
        } else {
          const fallback = Math.round((bookingFeeAmount / totalCents) * 10000) / 100
          if (Number.isFinite(fallback) && fallback > 0) {
            subscriptionApplicationFeePercent = fallback
          }
        }
      }
    }
  }

  const origin = request.nextUrl.origin
  const successUrl = body.successUrl ? String(body.successUrl) : `${origin}/`
  const cancelUrl = body.cancelUrl ? String(body.cancelUrl) : `${origin}/`

  try {
    const session = await createTenantCheckoutSession({
      tenant: {
        id: tenant.id,
        stripeConnectAccountId: tenant.stripeConnectAccountId,
        stripeConnectOnboardingStatus: tenant.stripeConnectOnboardingStatus,
      },
      price: priceId,
      mode,
      quantity,
      metadata,
      successUrl,
      cancelUrl,
      customerId,
      promotionCodeId,
      payload,
      bookingFeeAmount,
      productType: mode === 'subscription' ? 'subscription' : undefined,
      subscriptionApplicationFeePercent,
    })

    return NextResponse.json(session)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getPlatformStripe } from '@/lib/stripe/platform'
import { isStripeTestAccount } from '@/lib/stripe-connect/test-accounts'

type TenantStripeCustomer = { stripeAccountId: string; stripeCustomerId: string }

function parseStripeCustomers(value: unknown): TenantStripeCustomer[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row): row is TenantStripeCustomer => {
      if (!row || typeof row !== 'object') return false
      const r = row as Record<string, unknown>
      return typeof r.stripeAccountId === 'string' && typeof r.stripeCustomerId === 'string'
    })
    .map((row) => ({
      stripeAccountId: row.stripeAccountId.trim(),
      stripeCustomerId: row.stripeCustomerId.trim(),
    }))
    .filter((row) => Boolean(row.stripeAccountId && row.stripeCustomerId))
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const authResult = await payload.auth({ headers: request.headers })
  const user = authResult?.user ?? null

  if (!user || typeof user !== 'object' || !('id' in user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userIdRaw = (user as { id?: unknown }).id
  const userId = typeof userIdRaw === 'number' ? userIdRaw : typeof userIdRaw === 'string' ? parseInt(userIdRaw, 10) : NaN
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  const tenantCookie = request.cookies.get('payload-tenant')?.value
  const tenantId = tenantCookie && /^\d+$/.test(tenantCookie) ? parseInt(tenantCookie, 10) : null
  if (tenantId == null) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 })
  }

  const tenant = await payload
    .findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      select: { stripeConnectAccountId: true, stripeConnectOnboardingStatus: true } as any,
    })
    .catch(() => null)

  const stripeAccountId =
    tenant && typeof (tenant as any).stripeConnectAccountId === 'string'
      ? ((tenant as any).stripeConnectAccountId as string).trim()
      : ''
  const onboardingStatus =
    tenant && typeof (tenant as any).stripeConnectOnboardingStatus === 'string'
      ? ((tenant as any).stripeConnectOnboardingStatus as string).trim()
      : ''

  if (!stripeAccountId || onboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Stripe is not connected for this tenant' }, { status: 400 })
  }

  // In E2E/test placeholder accounts, never hit Stripe.
  if (isStripeTestAccount(stripeAccountId)) {
    return NextResponse.json({ url: request.nextUrl.origin + '/' })
  }

  const fullUser = await payload
    .findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      select: { stripeCustomers: true } as any,
    })
    .catch(() => null)

  const stripeCustomers = parseStripeCustomers((fullUser as any)?.stripeCustomers)
  const mapping = stripeCustomers.find((c) => c.stripeAccountId === stripeAccountId)
  if (!mapping) {
    return NextResponse.json(
      { error: 'No Stripe customer mapping for this tenant (ask an admin to set it on your user)' },
      { status: 400 },
    )
  }

  const stripe = getPlatformStripe()
  const session = await stripe.billingPortal.sessions.create(
    {
      customer: mapping.stripeCustomerId,
      return_url: request.nextUrl.origin + '/',
    },
    { stripeAccount: stripeAccountId },
  )

  return NextResponse.json({ url: session.url })
}


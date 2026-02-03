/**
 * Step 6 – Class pass purchase: create PaymentIntent for class pass.
 * Accepts quantity, optional expirationDays; tenant from context (slug/header). Never accept raw tenantId from body.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import type { User as SharedUser } from '@repo/shared-types'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'

const DEFAULT_PRICE_CENTS = 1000
const DEFAULT_EXPIRATION_DAYS = 365

type TenantWithClassPass = {
  id: number
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: string | null
  classPassSettings?: {
    enabled?: boolean
    defaultExpirationDays?: number
    pricing?: Array<{ quantity: number; price: number; name?: string }>
  } | null
}

/** Resolve tenant from headers/cookies only. Never call request.json() here — body is consumed by the handler. */
function resolveTenantFromRequest(request: NextRequest): string | null {
  if (process.env.NODE_ENV === 'test') {
    const id = request.headers.get('x-tenant-id')
    if (id) return id
  }
  return (
    request.headers.get('x-tenant-slug') ??
    request.cookies.get('tenant-slug')?.value ??
    null
  )
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  const authResult = await payload.auth({ headers: request.headers })
  const user = (authResult?.user as SharedUser) ?? null
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { quantity?: number; expirationDays?: number; tenantSlug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const quantity = typeof body.quantity === 'number' ? body.quantity : undefined
  if (quantity == null || quantity < 1) {
    return NextResponse.json({ error: 'quantity required and must be at least 1' }, { status: 400 })
  }

  const tenantSlugOrId = body.tenantSlug ?? resolveTenantFromRequest(request) ?? null
  if (!tenantSlugOrId) {
    return NextResponse.json({ error: 'Tenant context required (tenantSlug or x-tenant-slug / x-tenant-id)' }, { status: 400 })
  }

  let tenant: TenantWithClassPass | null = null
  if (process.env.NODE_ENV === 'test' && /^\d+$/.test(String(tenantSlugOrId))) {
    const t = await payload.findByID({
      collection: 'tenants',
      id: parseInt(String(tenantSlugOrId), 10),
      depth: 0,
      overrideAccess: true,
    })
    tenant = t as TenantWithClassPass
  }
  if (!tenant) {
    const result = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: String(tenantSlugOrId) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenant = (result.docs[0] as TenantWithClassPass) ?? null
  }

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  if (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  const settings = tenant.classPassSettings
  const expirationDays = typeof body.expirationDays === 'number'
    ? body.expirationDays
    : (settings?.defaultExpirationDays ?? DEFAULT_EXPIRATION_DAYS)

  const pricing = settings?.pricing ?? []
  const packageMatch = pricing.find((p) => p.quantity === quantity)
  const totalCents = packageMatch
    ? packageMatch.price
    : (pricing[0] ? Math.round((pricing[0].price / pricing[0].quantity) * quantity) : DEFAULT_PRICE_CENTS * quantity)

  try {
    const { client_secret } = await createTenantPaymentIntent({
      tenant: { id: tenant.id, stripeConnectAccountId: tenant.stripeConnectAccountId, stripeConnectOnboardingStatus: tenant.stripeConnectOnboardingStatus },
      classPriceAmount: totalCents,
      currency: 'eur',
      productType: 'class-pass',
      payload,
      metadata: {
        type: 'class_pass_purchase',
        userId: String(user.id),
        tenantId: String(tenant.id),
        quantity: String(quantity),
        expirationDays: String(expirationDays),
        totalCents: String(totalCents),
      },
    })
    return NextResponse.json({ clientSecret: client_secret })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getPayload } from '@/lib/payload'
import { createTenantPaymentIntent } from '@/lib/stripe-connect/charges'
import { formatAmountForStripe } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

type TenantForConnect = {
  id: number
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: string | null
}

function coerceMetadata(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const payload = await getPayload()

  const authResult = await payload.auth({ headers: request.headers })
  const user = (authResult?.user as SharedUser) ?? null
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { price?: unknown; metadata?: unknown }
  try {
    body = await request.json()
  } catch {
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

  // Resolve tenant from the lesson (never accept raw tenantId from the request body).
  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 0,
    overrideAccess: true,
  })) as { tenant?: number | { id: number } } | null

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
  })) as TenantForConnect | null

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  if (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  // Convert currency units (e.g. 18.00) into cents for Stripe + Connect PI routing.
  const classPriceAmountCents = formatAmountForStripe(price, 'eur')

  // E2E/CI: avoid calling Stripe and return deterministic response.
  if (process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_WEBHOOKS === 'true') {
    return NextResponse.json(
      { clientSecret: `pi_test_${Date.now()}_secret_test`, amount: price },
      { status: 200 },
    )
  }

  try {
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
      metadata: {
        ...(metadata ?? {}),
        lessonId: String(lessonId),
        userId: String(user.id),
      },
    })

    return NextResponse.json({ clientSecret: client_secret, amount: price }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


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

  const quantity = Math.max(1, parseInt(metadata?.quantity ?? '1', 10) || 1)

  // When client passes explicit bookingIds (modify-booking flow with pre-created pending bookings),
  // use those directly instead of quantity-based reserve logic. Otherwise only 1 booking is attached.
  const clientBookingIdsRaw = metadata?.bookingIds
  let bookingIds: string[] = []
  if (clientBookingIdsRaw && typeof clientBookingIdsRaw === 'string') {
    const parsed = clientBookingIdsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (parsed.length > 0) {
      const docs = await payload.find({
        collection: 'bookings',
        where: {
          and: [
            { id: { in: parsed.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)) } },
            { lesson: { equals: lessonId } },
            { user: { equals: user.id } },
            { status: { equals: 'pending' } },
          ],
        },
        depth: 0,
        limit: parsed.length,
        overrideAccess: true,
      })
      const validIds = (docs.docs as { id: number }[]).map((b) => String(b.id))
      if (validIds.length > 0) {
        bookingIds = validIds
      }
    }
  }

  // Resolve tenant and remaining capacity from the lesson (depth so virtual remainingCapacity is populated).
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
  // Only check capacity when using quantity-based reserve flow; explicit bookingIds were validated when created.
  if (bookingIds.length === 0 && quantity > remainingCapacity) {
    return NextResponse.json(
      {
        error:
          remainingCapacity === 0
            ? 'This lesson is fully booked.'
            : `Only ${remainingCapacity} spot${remainingCapacity !== 1 ? 's' : ''} available. You requested ${quantity}.`,
      },
      { status: 400 },
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
  })) as TenantForConnect | null

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  if (!tenant.stripeConnectAccountId || tenant.stripeConnectOnboardingStatus !== 'active') {
    return NextResponse.json({ error: 'Tenant is not connected to Stripe' }, { status: 400 })
  }

  const isTestMode =
    process.env.NODE_ENV === 'test' ||
    process.env.ENABLE_TEST_WEBHOOKS === 'true' ||
    /^acct_(fee_disclosure_|smoke_)/.test(tenant.stripeConnectAccountId ?? '')

  // Reserve capacity by creating or reusing pending bookings (prevents race: two users at checkout with 1 spot).
  // Skip when we already have explicit bookingIds from modify-booking flow, or in test mode.
  if (bookingIds.length === 0 && !isTestMode) {
    const pendingCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const existing = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { lesson: { equals: lessonId } },
          { user: { equals: user.id } },
          { status: { equals: 'pending' } },
          { createdAt: { greater_than: pendingCutoff } },
        ],
      },
      sort: 'id',
      limit: quantity,
      depth: 0,
      overrideAccess: true,
    })
    const existingIds = (existing.docs as { id: number }[]).map((b) => String(b.id))
    const need = quantity - existingIds.length
    if (need > 0) {
      const lessonNow = (await payload.findByID({
        collection: 'lessons',
        id: lessonId,
        depth: 1,
        overrideAccess: true,
      })) as { remainingCapacity?: number } | null
      const cap = lessonNow && typeof lessonNow.remainingCapacity === 'number' ? Math.max(0, lessonNow.remainingCapacity) : 0
      if (need > cap) {
        return NextResponse.json(
          {
            error:
              cap === 0
                ? 'This lesson is fully booked.'
                : `Only ${cap} spot${cap !== 1 ? 's' : ''} available. You requested ${quantity}.`,
          },
          { status: 400 },
        )
      }
      for (let i = 0; i < need; i++) {
        const created = await payload.create({
          collection: 'bookings',
          data: {
            user: user.id,
            lesson: lessonId,
            tenant: tenantId,
            status: 'pending',
          },
          overrideAccess: true,
        })
        existingIds.push(String(created.id))
      }
    }
    bookingIds = existingIds.slice(0, quantity)
  }

  // Convert currency units (e.g. 18.00) into cents for Stripe + Connect PI routing.
  const classPriceAmountCents = formatAmountForStripe(price, 'eur')

  // E2E/CI or placeholder account: avoid calling Stripe (would fail with "No such destination").
  if (isTestMode) {
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
        quantity: String(quantity),
        ...(bookingIds.length > 0 ? { bookingIds: bookingIds.join(',') } : {}),
      },
    })

    return NextResponse.json({ clientSecret: client_secret, amount: price }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment intent failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


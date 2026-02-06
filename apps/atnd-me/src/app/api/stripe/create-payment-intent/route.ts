import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { formatAmountForStripe } from '@repo/shared-utils'

export async function POST(request: NextRequest) {
  const payload = await getPayload()

  const auth = await payload.auth({
    headers: request.headers,
    canSetHeaders: false,
  })

  const user = auth.user as { id: number } | null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { price?: unknown; metadata?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const price = typeof body.price === 'number' ? body.price : null
  const metadata =
    body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, string>)
      : undefined

  if (price == null || Number.isNaN(price)) {
    return NextResponse.json({ error: 'Missing price' }, { status: 400 })
  }

  // E2E/CI: avoid calling Stripe (network) and return a deterministic response.
  if (process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_WEBHOOKS === 'true') {
    return NextResponse.json(
      { clientSecret: `pi_test_${Date.now()}_secret_test`, amount: price },
      { status: 200 },
    )
  }

  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
  }

  const userQuery = (await payload.findByID({
    collection: 'users',
    id: user.id,
    depth: 0,
  })) as { email?: string; stripeCustomerId?: string | null }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(price, 'eur'),
    automatic_payment_methods: { enabled: true },
    currency: 'eur',
    receipt_email: userQuery.email,
    customer: userQuery.stripeCustomerId || undefined,
    metadata: metadata ?? {},
  })

  return NextResponse.json(
    { clientSecret: paymentIntent.client_secret as string, amount: price },
    { status: 200 },
  )
}


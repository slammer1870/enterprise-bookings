/**
 * E2E test helper: simulates Stripe Connect customer.subscription.created webhook.
 * Builds a signed event and invokes the real webhook route so subscriptions + bookings are created.
 * Only enabled when ENABLE_TEST_WEBHOOKS=true or NODE_ENV=test.
 */
import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { Where } from 'payload'
import { getPayload } from '@/lib/payload'

export const dynamic = 'force-dynamic'

function isTestEnvironment() {
  return process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_WEBHOOKS === 'true'
}

function disabledResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

function signWebhookPayload(body: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000)
  const payload = `${t}.${body}`
  const v1 = createHmac('sha256', secret).update(payload).digest('hex')
  return `t=${t},v1=${v1}`
}

export async function POST(request: NextRequest) {
  if (!isTestEnvironment()) {
    return disabledResponse()
  }

  const webhookSecret =
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || 'test_webhook_secret'

  try {
    const body = await request.json()
    const {
      userEmail,
      timeslotId,
      lessonId,
      bookingIds,
      tenantId: tenantIdParam,
    } = body as {
      userEmail?: string
      timeslotId?: number
      lessonId?: number
      bookingIds?: string
      tenantId?: number
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail is required' },
        { status: 400 }
      )
    }

    const payload = await getPayload()

    const userQuery = await payload.find({
      collection: 'users',
      where: { email: { equals: userEmail } },
      limit: 1,
      overrideAccess: true,
    })
    const user = userQuery.docs[0] as { id: number; stripeCustomerId?: string } | undefined
    if (!user) {
      return NextResponse.json(
        { error: `User not found: ${userEmail}` },
        { status: 400 }
      )
    }

    const stripeCustomerId = user.stripeCustomerId || `cus_test_${Date.now()}`
    if (!user.stripeCustomerId) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { stripeCustomerId },
        overrideAccess: true,
      })
    }

    const tenantWhere: Where = {
      stripeConnectAccountId: { exists: true },
      stripeConnectOnboardingStatus: { equals: 'active' },
      ...(tenantIdParam != null ? { id: { equals: tenantIdParam } } : {}),
    }
    const tenantResult = await payload.find({
      collection: 'tenants',
      where: tenantWhere,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenantResult.docs[0] as {
      id: number
      stripeConnectAccountId?: string
    } | undefined
    if (!tenant?.stripeConnectAccountId) {
      return NextResponse.json(
        {
          error:
            'No tenant with stripeConnectAccountId found. Ensure tenant is connected for subscription tests.',
        },
        { status: 400 }
      )
    }

    const planQuery = await payload.find({
      collection: 'plans',
      where: { tenant: { equals: tenant.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const plan = planQuery.docs[0] as { id: number; stripeProductId?: string } | undefined
    if (!plan) {
      return NextResponse.json(
        { error: 'No plans available for subscription test' },
        { status: 400 }
      )
    }
    const stripeProductId = plan.stripeProductId || `prod_test_${Date.now()}`

    const subscriptionId = `sub_test_${Date.now()}`
    const now = Math.floor(Date.now() / 1000)

    const slotId = timeslotId ?? lessonId
    const metadata: Record<string, string> = {}
    if (slotId != null) metadata.timeslotId = String(slotId)
    if (bookingIds) metadata.bookingIds = bookingIds

    const event = {
      id: `evt_sub_created_${Date.now()}`,
      type: 'customer.subscription.created',
      account: tenant.stripeConnectAccountId,
      data: {
        object: {
          id: subscriptionId,
          object: 'subscription',
          customer: stripeCustomerId,
          status: 'active',
          current_period_start: now,
          current_period_end: now + 30 * 24 * 60 * 60,
          cancel_at: null,
          metadata,
          items: {
            object: 'list',
            data: [
              {
                id: `si_test_${Date.now()}`,
                object: 'subscription_item',
                plan: { id: `price_test_${Date.now()}`, product: stripeProductId },
              },
            ],
          },
        },
      },
    }

    const bodyStr = JSON.stringify(event)
    const signature = signWebhookPayload(bodyStr, webhookSecret)

    const webhookRequest = new NextRequest(
      'http://localhost/api/stripe/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': signature,
        },
        body: bodyStr,
      }
    )

    const { POST } = await import('@/app/api/stripe/webhook/route')
    const res = await POST(webhookRequest)
    const status = res.status

    if (status !== 200) {
      const txt = await res.text()
      return NextResponse.json(
        { error: `Webhook returned ${status}: ${txt}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing test subscription webhook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

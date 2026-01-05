import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { subscriptionCreated } from '@repo/memberships'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

function isTestEnvironment() {
  return process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_WEBHOOKS === 'true'
}

function disabledResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(request: NextRequest) {
  if (!isTestEnvironment()) return disabledResponse()

  try {
    const body = await request.json()
    const { userEmail, lessonId } = body as { userEmail?: string; lessonId?: number }

    const payload = await getPayload({ config: await config })

    // 1) User + stripeCustomerId
    let stripeCustomerId = `cus_test_${Date.now()}`
    if (userEmail) {
      const userQuery = await payload.find({
        collection: 'users',
        where: { email: { equals: userEmail } },
        limit: 1,
        overrideAccess: true,
      })
      const user = userQuery.docs[0]
      if (user) {
        stripeCustomerId = (user as any).stripeCustomerId || stripeCustomerId
        if (!(user as any).stripeCustomerId) {
          await payload.update({
            collection: 'users',
            id: user.id,
            data: { stripeCustomerId },
            overrideAccess: true,
          })
        }
      }
    }

    // 2) Plan with stripeProductId (create fake id if missing)
    const planQuery = await payload.find({
      collection: 'plans',
      limit: 1,
      sort: '-createdAt',
      overrideAccess: true,
    })
    const plan: any = planQuery.docs[0]
    if (!plan) {
      return NextResponse.json({ error: 'No plans available for subscription test' }, { status: 400 })
    }

    const stripeProductId = plan.stripeProductId || `prod_test_${Date.now()}`
    if (!plan.stripeProductId) {
      await payload.update({
        collection: 'plans',
        id: plan.id,
        data: { stripeProductId },
        overrideAccess: true,
      })
    }

    const subscriptionId = `sub_test_${Date.now()}`
    const mockEvent: Stripe.Event = {
      id: `evt_sub_created_${Date.now()}`,
      object: 'event',
      api_version: '2020-08-27',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: subscriptionId,
          object: 'subscription',
          customer: stripeCustomerId,
          items: {
            object: 'list',
            data: [
              {
                id: `si_test_${Date.now()}`,
                object: 'subscription_item',
                plan: {
                  id: `plan_${Date.now()}`,
                  object: 'plan',
                  product: stripeProductId,
                } as unknown as Stripe.Plan,
              } as unknown as Stripe.SubscriptionItem,
            ],
            has_more: false,
            url: '',
          },
          metadata: lessonId ? { lessonId: lessonId.toString() } : {},
        } as unknown as Stripe.Subscription,
      },
      livemode: false,
      pending_webhooks: 0,
      request: { id: null, idempotency_key: null },
      type: 'customer.subscription.created',
    }

    await subscriptionCreated({
      event: mockEvent as any,
      payload,
      config: {} as any,
      req: {} as any,
      stripe: {} as any,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing test subscription webhook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}




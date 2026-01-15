import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { paymentIntentSucceeded } from '@repo/payments-plugin'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic'

function isTestEnvironment() {
  return process.env.NODE_ENV === 'test' || process.env.ENABLE_TEST_WEBHOOKS === 'true'
}

function disabledResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(request: NextRequest) {
  if (!isTestEnvironment()) {
    return disabledResponse()
  }

  try {
    const body = await request.json()
    const { event, userEmail } = body

    if (!event || !event.data || !event.data.object) {
      return NextResponse.json({ error: 'Invalid event structure' }, { status: 400 })
    }

    const payload = await getPayload({ config: await config })

    // If userEmail is provided, look up the user and use their actual stripeCustomerId
    if (userEmail) {
      const userQuery = await payload.find({
        collection: 'users',
        where: {
          email: { equals: userEmail },
        },
        limit: 1,
        overrideAccess: true,
      })

      const user = userQuery.docs[0]
      if (user) {
        // Use the user's actual stripeCustomerId, or create one if they don't have it
        const stripeCustomerId = user.stripeCustomerId || `cus_test_${Date.now()}`
        
        // Update user with customer ID if they don't have one
        if (!user.stripeCustomerId) {
          await payload.update({
            collection: 'users',
            id: user.id,
            data: {
              stripeCustomerId,
            },
            overrideAccess: true,
          })
        }

        // Update the event with the actual customer ID
        event.data.object.customer = stripeCustomerId
      }
    }

    // Call the webhook handler
    await paymentIntentSucceeded({
      event: event as {
        data: {
          object: Stripe.PaymentIntent
        }
      },
      payload,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error processing test webhook:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}


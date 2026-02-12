/**
 * Stripe Connect webhook: account.*, payment_intent.succeeded, customer.subscription.*.
 * Verifies signature, resolves tenant, updates bookings/subscriptions, enforces idempotency.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { verifyStripeConnectWebhook } from '@/lib/stripe-connect/webhookVerify'
import {
  hasProcessedStripeConnectEvent,
  markStripeConnectEventProcessed,
} from '@/lib/stripe-connect/webhookProcessed'
import {
  parseBookingIds,
  getAccountIdFromEvent,
  resolveTenant,
  confirmBookingsFromPaymentIntent,
  confirmBookingsFromQuantityFlow,
  confirmBookingsFromSubscriptionMetadata,
  findOrCreateAndConfirmBookingForLesson,
} from '@/lib/stripe-connect/webhook'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature' }, { status: 400 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  let event
  try {
    event = verifyStripeConnectWebhook(rawBody, signature)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (hasProcessedStripeConnectEvent(event.id)) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const payload = await getPayload()

  if (event.type === 'payment_intent.succeeded') {
    const obj = event.data?.object as {
      id?: string
      metadata?: Record<string, string>
    } | undefined
    const meta = obj?.metadata ?? {}

    const accountId = getAccountIdFromEvent(event)
    const tenant = await resolveTenant(payload, accountId, meta.tenantId)
    const bookingIdsToConfirm = parseBookingIds(meta)

    // Class pass purchase (no bookingIds)
    if (
      tenant &&
      meta.type === 'class_pass_purchase' &&
      !meta.bookingId &&
      !meta.bookingIds
    ) {
      const userId = meta.userId
      const quantity = meta.quantity ? parseInt(meta.quantity, 10) : 0
      const expirationDays = meta.expirationDays ? parseInt(meta.expirationDays, 10) : 365
      const totalCents = meta.totalCents ? parseInt(meta.totalCents, 10) : 0
      const transactionId = obj?.id ?? null
      if (userId && quantity >= 1) {
        const now = new Date()
        const expirationDate = new Date(now)
        expirationDate.setDate(expirationDate.getDate() + expirationDays)
        await payload.create({
          collection: 'class-passes' as import('payload').CollectionSlug,
          draft: false,
          data: {
            user: Number(userId),
            tenant: tenant.id,
            quantity,
            expirationDate: expirationDate.toISOString().slice(0, 10),
            purchasedAt: now.toISOString().slice(0, 10),
            price: totalCents,
            status: 'active',
            ...(transactionId ? { transactionId } : {}),
          } as Record<string, unknown>,
          overrideAccess: true,
        })
      }
    }

    // Explicit booking IDs (drop-in / modify-booking flow)
    if (tenant && bookingIdsToConfirm.length > 0) {
      await confirmBookingsFromPaymentIntent(payload, bookingIdsToConfirm, {
        paymentIntentId: typeof obj?.id === 'string' ? obj.id : undefined,
        tenantId: tenant.id,
      })
    }
    // Legacy quantity-based flow (lessonId + userId, no explicit bookingIds)
    else if (
      tenant &&
      meta.lessonId &&
      meta.userId &&
      !meta.type &&
      bookingIdsToConfirm.length === 0
    ) {
      const lessonId = parseInt(meta.lessonId, 10)
      const userId = parseInt(meta.userId, 10)
      const quantity = Math.max(1, parseInt(meta.quantity ?? '1', 10) || 1)
      if (!Number.isNaN(lessonId) && !Number.isNaN(userId)) {
        await confirmBookingsFromQuantityFlow(payload, {
          lessonId,
          userId,
          quantity,
          paymentIntentId: typeof obj?.id === 'string' ? obj.id : undefined,
          tenantId: tenant.id,
        })
      }
    }

    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const accountId = getAccountIdFromEvent(event)
  const isSubscriptionEvent =
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.paused' ||
    event.type === 'customer.subscription.resumed'

  // Subscription checkouts are created on the platform (tRPC uses platform Stripe), so
  // customer.subscription.* arrives with no event.account. Resolve tenant from subscription
  // metadata.tenantId when accountId is missing.
  let tenant: Awaited<ReturnType<typeof resolveTenant>> = null
  if (isSubscriptionEvent && !accountId) {
    const subObj = event.data?.object as { metadata?: { tenantId?: string } } | undefined
    const metaTenantId = subObj?.metadata?.tenantId
    if (metaTenantId) {
      tenant = await resolveTenant(payload, undefined, metaTenantId)
    }
  }
  if (!tenant && accountId) {
    tenant = await resolveTenant(payload, accountId)
  }
  if (!tenant) {
    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const tenantId = tenant.id

  if (isSubscriptionEvent) {
    const obj = event.data?.object as {
      id?: string
      customer?: string | { id?: string }
      status?: string
      current_period_start?: number
      current_period_end?: number
      cancel_at?: number
      items?: { data?: Array<{ plan?: { product?: string } }> }
      metadata?: { lessonId?: string; lesson_id?: string; bookingIds?: string; tenantId?: string }
    } | undefined
    if (!obj?.id) {
      markStripeConnectEventProcessed(event.id)
      return NextResponse.json({ received: true }, { status: 200 })
    }
    const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
    const planProductId = obj.items?.data?.[0]?.plan?.product
    const currentPeriodStart = obj.current_period_start
    const currentPeriodEnd = obj.current_period_end
    const cancelAt = obj.cancel_at

    if (event.type === 'customer.subscription.created') {
      if (!customerId || !planProductId) {
        markStripeConnectEventProcessed(event.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }
      const userResult = await payload.find({
        collection: 'users',
        where: { stripeCustomerId: { equals: customerId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const user = userResult.docs[0] as { id: number } | undefined
      if (!user) {
        markStripeConnectEventProcessed(event.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }
      const planResult = await payload.find({
        collection: 'plans',
        where: {
          stripeProductId: { equals: planProductId },
          tenant: { equals: tenantId },
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const plan = planResult.docs[0] as { id: number } | undefined
      if (!plan) {
        markStripeConnectEventProcessed(event.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }
      const existing = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: obj.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        markStripeConnectEventProcessed(event.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }
      const created = await payload.create({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        data: {
          tenant: tenantId,
          user: user.id,
          plan: plan.id,
          status: (obj.status as 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'paused') ?? 'active',
          stripeSubscriptionId: obj.id,
          startDate: currentPeriodStart
            ? new Date(currentPeriodStart * 1000).toISOString()
            : null,
          endDate: currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : null,
          cancelAt: cancelAt ? new Date(cancelAt * 1000).toISOString() : null,
          skipSync: true,
        } as Record<string, unknown>,
        overrideAccess: true,
      })
      const subId = created.id as number
      const meta = obj.metadata ?? {}
      const lessonId = meta.lessonId ?? meta.lesson_id
      const bookingIdsFromMeta = parseBookingIds(meta)

      if (bookingIdsFromMeta.length > 0) {
        await confirmBookingsFromSubscriptionMetadata(payload, bookingIdsFromMeta, subId)
      } else if (lessonId) {
        const lessonIdNum = Number(lessonId)
        if (Number.isFinite(lessonIdNum)) {
          try {
            await findOrCreateAndConfirmBookingForLesson(payload, {
              lessonId: lessonIdNum,
              userId: user.id,
              tenantId,
              subscriptionId: subId,
            })
          } catch (e) {
            payload.logger?.error?.(`Failed to confirm booking for lesson ${lessonId}: ${e}`)
          }
        }
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.paused' ||
      event.type === 'customer.subscription.resumed'
    ) {
      const subResult = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: obj.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const sub = subResult.docs[0] as { id: number } | undefined
      if (sub) {
        const updateData: Record<string, unknown> = {
          skipSync: true,
        }
        if (event.type === 'customer.subscription.paused') {
          updateData.status = 'paused'
        } else if (event.type === 'customer.subscription.resumed') {
          updateData.status = 'active'
        } else if (obj.status != null) {
          updateData.status = obj.status as 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
        }
        if (currentPeriodStart != null) {
          updateData.startDate = new Date(currentPeriodStart * 1000).toISOString()
        }
        if (currentPeriodEnd != null) {
          updateData.endDate = new Date(currentPeriodEnd * 1000).toISOString()
        }
        if (cancelAt != null) {
          updateData.cancelAt = new Date(cancelAt * 1000).toISOString()
        }
        await payload.update({
          collection: 'subscriptions' as import('payload').CollectionSlug,
          id: sub.id,
          data: updateData,
          overrideAccess: true,
        })
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subResult = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: obj.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const sub = subResult.docs[0] as { id: number } | undefined
      if (sub) {
        await payload.update({
          collection: 'subscriptions' as import('payload').CollectionSlug,
          id: sub.id,
          data: {
            status: 'canceled',
            endDate: currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000).toISOString()
              : new Date().toISOString(),
            cancelAt: cancelAt ? new Date(cancelAt * 1000).toISOString() : new Date().toISOString(),
            skipSync: true,
          } as Record<string, unknown>,
          overrideAccess: true,
        })
      }
    }
    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (event.type === 'account.updated') {
    const obj = (event.data?.object ?? {}) as { charges_enabled?: boolean }
    const status = obj.charges_enabled === true ? 'active' : 'restricted'
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { stripeConnectOnboardingStatus: status },
      overrideAccess: true,
    })
  } else if (event.type === 'account.application.deauthorized') {
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectAccountId: null,
        stripeConnectOnboardingStatus: 'deauthorized',
      },
      overrideAccess: true,
    })
    console.info('[Stripe Connect] deauthorized', { tenantId: tenant.id })
  }

  markStripeConnectEventProcessed(event.id)
  return NextResponse.json({ received: true }, { status: 200 })
}

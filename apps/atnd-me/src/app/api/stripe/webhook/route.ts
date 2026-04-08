/**
 * Stripe Connect webhook: account.*, payment_intent.succeeded, customer.subscription.*, product.*, price.*.
 * Verifies signature, resolves tenant, updates bookings/subscriptions, enforces idempotency.
 * Subscription date fields use YYYY-MM-DD to match the collection's dayOnly picker.
 */
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

/** Format Stripe Unix timestamp as date-only (YYYY-MM-DD) for Payload dayOnly date fields. */
function stripeDateOnly(unix: number | null | undefined): string | null {
  if (unix == null) return null
  return new Date(unix * 1000).toISOString().slice(0, 10)
}
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import {
  assertConnectWebhookEventApiVersion,
  warnIfConnectWebhookEventApiVersionMismatch,
} from '@/lib/stripe-connect/connectWebhookApiVersion'
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
import {
  getStripeProductIdFromWebhookObject,
  syncStripeProductToPayload,
} from '@/lib/stripe-connect/webhook/sync-products'
import { getStripeConnectOnboardingStatus } from '@/lib/stripe-connect/account-status'

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

  try {
    assertConnectWebhookEventApiVersion(event)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Webhook API version mismatch'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  warnIfConnectWebhookEventApiVersionMismatch(event)

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
    const paymentIntentTenantContext = tenant ? { tenant: tenant.id } : null

    // Class pass purchase
    if (
      tenant &&
      meta.type === 'class_pass_purchase' &&
      !meta.bookingId
    ) {
      const userId = meta.userId
      const classPassTypeId = meta.classPassTypeId ? parseInt(meta.classPassTypeId, 10) : NaN
      const expirationDays = meta.expirationDays ? parseInt(meta.expirationDays, 10) : 365
      const totalCents = meta.totalCents ? parseInt(meta.totalCents, 10) : 0
      const transactionId = obj?.id ?? null
      if (userId && Number.isFinite(classPassTypeId) && classPassTypeId > 0) {
        const classPassType = (await payload.findByID({
          collection: 'class-pass-types' as import('payload').CollectionSlug,
          id: classPassTypeId,
          depth: 0,
          overrideAccess: true,
        }).catch(() => null)) as { quantity?: number } | null
        const passCredits =
          classPassType && typeof classPassType.quantity === 'number'
            ? classPassType.quantity
            : 0

        if (passCredits < 1) {
          markStripeConnectEventProcessed(event.id)
          return NextResponse.json({ received: true }, { status: 200 })
        }

        const now = new Date()
        const expirationDate = new Date(now)
        expirationDate.setDate(expirationDate.getDate() + expirationDays)
        await payload.create({
          collection: 'class-passes' as import('payload').CollectionSlug,
          draft: false,
          data: {
            user: Number(userId),
            tenant: tenant.id,
            type: classPassTypeId,
            quantity: passCredits,
            expirationDate: expirationDate.toISOString().slice(0, 10),
            purchasedAt: now.toISOString().slice(0, 10),
            price: totalCents,
            status: 'active',
            ...(transactionId ? { transactionId } : {}),
          } as Record<string, unknown>,
          ...(paymentIntentTenantContext ? { context: paymentIntentTenantContext } : {}),
          overrideAccess: true,
        })
      }
    }

    // Explicit booking IDs (drop-in / modify-booking flow)
    if (tenant && bookingIdsToConfirm.length > 0) {
      await confirmBookingsFromPaymentIntent(payload, bookingIdsToConfirm, {
        paymentIntentId: typeof obj?.id === 'string' ? obj.id : undefined,
        tenantId: tenant.id,
        tenantContext: paymentIntentTenantContext,
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
          tenantContext: paymentIntentTenantContext,
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
    if (isSubscriptionEvent) {
      const subObj = event.data?.object as { id?: string; metadata?: { tenantId?: string } } | undefined
      payload.logger?.info?.(`subscription event skipped: tenant not resolved (event=${event.type}, sub=${subObj?.id}, metadata.tenantId=${subObj?.metadata?.tenantId ?? 'null'}, accountId=${accountId ?? 'null'})`)
    }
    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const tenantId = tenant.id
  const tenantContext = { tenant: tenantId }
  const isProductSyncEvent =
    event.type === 'product.updated' ||
    event.type === 'product.deleted' ||
    event.type === 'price.created' ||
    event.type === 'price.updated' ||
    event.type === 'price.deleted'

  if (isProductSyncEvent) {
    if (!accountId) {
      payload.logger?.info?.(`product sync event skipped: missing account id (event=${event.type})`)
      markStripeConnectEventProcessed(event.id)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    const stripeProductId = getStripeProductIdFromWebhookObject(
      event.data?.object as Record<string, unknown> | undefined,
    )

    if (!stripeProductId) {
      payload.logger?.info?.(`product sync event skipped: missing stripe product id (event=${event.type})`)
      markStripeConnectEventProcessed(event.id)
      return NextResponse.json({ received: true }, { status: 200 })
    }

    try {
      await syncStripeProductToPayload({
        payload,
        tenantId,
        accountId,
        stripeProductId,
        fallbackProduct:
          event.type === 'product.deleted'
            ? ((event.data?.object as Record<string, unknown> | undefined) as Partial<Stripe.Product> | undefined)
            : undefined,
      })
    } catch (error) {
      payload.logger?.error?.(
        `Failed to sync Stripe product ${stripeProductId} from webhook ${event.type}: ${error}`,
      )
    }

    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (isSubscriptionEvent) {
    const obj = event.data?.object as {
      id?: string
      customer?: string | { id?: string }
      status?: string
      start_date?: number
      current_period_start?: number
      current_period_end?: number
      cancel_at?: number
      items?: {
        data?: Array<{
          plan?: { product?: string }
          current_period_start?: number
          current_period_end?: number
        }>
      }
      metadata?: { lessonId?: string; lesson_id?: string; bookingIds?: string; tenantId?: string }
    } | undefined
    if (!obj?.id) {
      markStripeConnectEventProcessed(event.id)
      return NextResponse.json({ received: true }, { status: 200 })
    }
    const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
    const planProductId = obj.items?.data?.[0]?.plan?.product
    const firstItem = obj.items?.data?.[0]
    // Period dates: Stripe may send at subscription root or only on the first subscription item (e.g. 2025 API)
    const currentPeriodStart =
      obj.current_period_start ??
      firstItem?.current_period_start ??
      obj.start_date
    const currentPeriodEnd =
      obj.current_period_end ?? firstItem?.current_period_end
    const cancelAt = obj.cancel_at

    if (event.type === 'customer.subscription.created') {
      if (!customerId || !planProductId) {
        payload.logger?.info?.(`subscription.created skipped: missing customerId or planProductId (sub=${obj.id}, customerId=${customerId ?? 'null'}, planProductId=${planProductId ?? 'null'})`)
        markStripeConnectEventProcessed(event.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }
      const userResult = await payload.find({
        collection: 'users',
        where: { stripeCustomerId: { equals: customerId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      })
      const user = userResult.docs[0] as { id: number } | undefined
      if (!user) {
        payload.logger?.info?.(`subscription.created skipped: no user with stripeCustomerId=${customerId} (sub=${obj.id})`)
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
        select: { id: true } as any,
      })
      const plan = planResult.docs[0] as { id: number } | undefined
      if (!plan) {
        payload.logger?.info?.(`subscription.created skipped: no plan with stripeProductId=${planProductId} and tenant=${tenantId} (sub=${obj.id})`)
        markStripeConnectEventProcessed(event.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }
      const existing = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: obj.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      })
      if (existing.docs.length > 0) {
        // subscription.updated may have created the record first; still run booking confirmation
        const existingSub = existing.docs[0] as { id: number }
        const meta = obj.metadata ?? {}
        const lessonId = meta.lessonId ?? meta.lesson_id
        const bookingIdsFromMeta = parseBookingIds(meta)
        if (bookingIdsFromMeta.length > 0) {
          await confirmBookingsFromSubscriptionMetadata(payload, bookingIdsFromMeta, existingSub.id)
        } else if (lessonId) {
          const lessonIdNum = Number(lessonId)
          if (Number.isFinite(lessonIdNum)) {
            try {
              await findOrCreateAndConfirmBookingForLesson(payload, {
                lessonId: lessonIdNum,
                userId: user.id,
                tenantId,
                subscriptionId: existingSub.id,
                tenantContext,
              })
            } catch (e) {
              payload.logger?.error?.(`Failed to confirm booking for lesson ${lessonId}: ${e}`)
            }
          }
        }
        markStripeConnectEventProcessed(event.id)
        return NextResponse.json({ received: true }, { status: 200 })
      }
      const allowedStatuses = ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'] as const
      const rawStatus = obj.status && allowedStatuses.includes(obj.status as (typeof allowedStatuses)[number])
        ? (obj.status as (typeof allowedStatuses)[number])
        : 'active'
      // At creation Stripe often sends "incomplete" (first payment still processing). Show as "active" in admin
      // until subscription.updated delivers the final status (active, past_due, canceled, etc.).
      const status = rawStatus === 'incomplete' ? 'active' : rawStatus
      const created = await payload.create({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        data: {
          tenant: tenantId,
          user: user.id,
          plan: plan.id,
          status,
          stripeSubscriptionId: obj.id,
          startDate: stripeDateOnly(currentPeriodStart),
          endDate: stripeDateOnly(currentPeriodEnd),
          cancelAt: stripeDateOnly(cancelAt),
        } as Record<string, unknown>,
        context: { ...(tenantContext ?? {}), skipStripeSync: true },
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
              tenantContext,
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
        select: { id: true } as any,
      })
      const sub = subResult.docs[0] as { id: number } | undefined
      if (sub) {
        const updateData: Record<string, unknown> = {
        }
        if (event.type === 'customer.subscription.paused') {
          updateData.status = 'paused'
        } else if (event.type === 'customer.subscription.resumed') {
          updateData.status = 'active'
        } else if (obj.status != null) {
          updateData.status = obj.status as 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
        }
        if (currentPeriodStart != null) {
          updateData.startDate = stripeDateOnly(currentPeriodStart)
        }
        if (currentPeriodEnd != null) {
          updateData.endDate = stripeDateOnly(currentPeriodEnd)
        }
        updateData.cancelAt = stripeDateOnly(cancelAt)
        await payload.update({
          collection: 'subscriptions' as import('payload').CollectionSlug,
          id: sub.id,
          data: updateData,
          context: { ...(tenantContext ?? {}), skipStripeSync: true },
          overrideAccess: true,
        })
      } else {
        // subscription.updated can arrive before subscription.created; create record so status/dates are correct
        if (customerId && planProductId) {
          const userResult = await payload.find({
            collection: 'users',
            where: { stripeCustomerId: { equals: customerId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            select: { id: true } as any,
          })
          const user = userResult.docs[0] as { id: number } | undefined
          const planResult = await payload.find({
            collection: 'plans',
            where: {
              stripeProductId: { equals: planProductId },
              tenant: { equals: tenantId },
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
            select: { id: true } as any,
          })
          const plan = planResult.docs[0] as { id: number } | undefined
          if (user && plan) {
            const existingAgain = await payload.find({
              collection: 'subscriptions' as import('payload').CollectionSlug,
              where: { stripeSubscriptionId: { equals: obj.id } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
              select: { id: true } as any,
            })
            if (existingAgain.docs.length === 0) {
              const allowedStatuses = ['incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'] as const
              const status = obj.status && allowedStatuses.includes(obj.status as (typeof allowedStatuses)[number])
                ? (obj.status as (typeof allowedStatuses)[number])
                : 'active'
              const createdSub = await payload.create({
                collection: 'subscriptions' as import('payload').CollectionSlug,
                data: {
                  tenant: tenantId,
                  user: user.id,
                  plan: plan.id,
                  status: event.type === 'customer.subscription.paused' ? 'paused' : event.type === 'customer.subscription.resumed' ? 'active' : status,
                  stripeSubscriptionId: obj.id,
                  startDate: stripeDateOnly(currentPeriodStart),
                  endDate: stripeDateOnly(currentPeriodEnd),
                  cancelAt: stripeDateOnly(cancelAt),
                } as Record<string, unknown>,
                context: { ...(tenantContext ?? {}), skipStripeSync: true },
                overrideAccess: true,
              })
              const subId = createdSub.id as number
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
                      tenantContext,
                    })
                  } catch (e) {
                    payload.logger?.error?.(`Failed to confirm booking for lesson ${lessonId}: ${e}`)
                  }
                }
              }
            }
          }
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subResult = await payload.find({
        collection: 'subscriptions' as import('payload').CollectionSlug,
        where: { stripeSubscriptionId: { equals: obj.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      })
      const sub = subResult.docs[0] as { id: number } | undefined
      if (sub) {
        await payload.update({
          collection: 'subscriptions' as import('payload').CollectionSlug,
          id: sub.id,
          data: {
            status: 'canceled',
            endDate: stripeDateOnly(currentPeriodEnd) ?? new Date().toISOString().slice(0, 10),
            cancelAt: stripeDateOnly(cancelAt) ?? new Date().toISOString().slice(0, 10),
          } as Record<string, unknown>,
          context: { ...(tenantContext ?? {}), skipStripeSync: true },
          overrideAccess: true,
        })
      }
    }
    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (event.type === 'account.updated') {
    const obj = (event.data?.object ?? {}) as Parameters<
      typeof getStripeConnectOnboardingStatus
    >[0]
    const status = getStripeConnectOnboardingStatus(obj)
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: { stripeConnectOnboardingStatus: status },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
      select: { id: true } as any,
    })
  } else if (event.type === 'account.application.deauthorized') {
    await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: {
        stripeConnectAccountId: null,
        stripeConnectOnboardingStatus: 'deauthorized',
      },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
      select: { id: true } as any,
    })
    console.info('[Stripe Connect] deauthorized', {
      tenantId: tenant.id,
      eventId: event.id,
      eventType: event.type,
    })
  }

  markStripeConnectEventProcessed(event.id)
  return NextResponse.json({ received: true }, { status: 200 })
}

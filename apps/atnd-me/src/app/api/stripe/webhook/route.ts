/**
 * Step 2.5 / 2.8 – Stripe Connect webhook (account.*, payment_intent.succeeded, customer.subscription.*).
 * Handles created/updated/deleted/paused/resumed; verifies signature, resolves tenant, updates status/booking/subscription, enforces idempotency.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from '@/lib/payload'
import { verifyStripeConnectWebhook } from '@/lib/stripe-connect/webhookVerify'
import {
  hasProcessedStripeConnectEvent,
  markStripeConnectEventProcessed,
} from '@/lib/stripe-connect/webhookProcessed'
import type { StripeConnectEvent } from '@/lib/stripe-connect/webhookVerify'

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

  let event: StripeConnectEvent
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
      metadata?: {
        tenantId?: string
        bookingId?: string
        bookingIds?: string
        lessonId?: string
        type?: string
        userId?: string
        quantity?: string
        expirationDays?: string
        totalCents?: string
      }
    } | undefined
    const meta = obj?.metadata ?? {}
    const metaTenantId = meta.tenantId
    const bookingIdFromMeta = meta.bookingId
    const bookingIdsFromMeta = meta.bookingIds
    const lessonIdFromMeta = meta.lessonId
    const userIdFromMeta = meta.userId
    const typeFromMeta = meta.type

    let tenant: { id: number } | null = null
    const accountId = typeof event.account === 'string' ? event.account : (event.account as { id?: string })?.id
    if (accountId) {
      const tr = await payload.find({
        collection: 'tenants',
        where: { stripeConnectAccountId: { equals: accountId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenant = tr.docs[0] ?? null
    }
    if (!tenant && metaTenantId) {
      try {
        const t = await payload.findByID({
          collection: 'tenants',
          id: Number(metaTenantId),
          overrideAccess: true,
        })
        tenant = t
      } catch {
        tenant = null
      }
    }

    if (tenant && typeFromMeta === 'class_pass_purchase' && !bookingIdFromMeta && !bookingIdsFromMeta) {
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

    const bookingIdsToConfirm: number[] = []
    if (meta.bookingId) {
      const id = parseInt(meta.bookingId, 10)
      if (!Number.isNaN(id)) bookingIdsToConfirm.push(id)
    }
    if (meta.bookingIds) {
      const ids = meta.bookingIds
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n))
      bookingIdsToConfirm.push(...ids)
    }

    if (tenant && bookingIdsToConfirm.length > 0) {
      const paymentIntentId = typeof obj?.id === 'string' ? obj.id : undefined
      for (const bookingId of bookingIdsToConfirm) {
        if (paymentIntentId) {
          await payload.create({
            collection: 'transactions' as import('payload').CollectionSlug,
            data: {
              booking: bookingId,
              paymentMethod: 'stripe',
              stripePaymentIntentId: paymentIntentId,
              ...(tenant?.id ? { tenant: tenant.id } : {}),
            } as Record<string, unknown>,
            overrideAccess: true,
          })
        }
        await payload.update({
          collection: 'bookings',
          id: bookingId,
          data: { status: 'confirmed' },
          overrideAccess: true,
        })
      }
    } else if (
      tenant &&
      lessonIdFromMeta &&
      userIdFromMeta &&
      !typeFromMeta &&
      bookingIdsToConfirm.length === 0
    ) {
      const lessonId = parseInt(lessonIdFromMeta, 10)
      const userId = parseInt(userIdFromMeta, 10)
      if (!Number.isNaN(lessonId) && !Number.isNaN(userId)) {
        const paymentIntentId = typeof obj?.id === 'string' ? obj.id : undefined
        const created = await payload.create({
          collection: 'bookings' as import('payload').CollectionSlug,
          data: {
            lesson: lessonId,
            user: userId,
            tenant: tenant.id,
            status: 'confirmed',
          } as Record<string, unknown>,
          overrideAccess: true,
        })
        if (paymentIntentId && created?.id) {
          await payload.create({
            collection: 'transactions' as import('payload').CollectionSlug,
            data: {
              booking: created.id,
              paymentMethod: 'stripe',
              stripePaymentIntentId: paymentIntentId,
              tenant: tenant.id,
            } as Record<string, unknown>,
            overrideAccess: true,
          })
        }
      }
    }

    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const accountId = typeof event.account === 'string' ? event.account : (event.account as { id?: string })?.id
  if (!accountId) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const tenantResult = await payload.find({
    collection: 'tenants',
    where: { stripeConnectAccountId: { equals: accountId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const tenant = tenantResult.docs[0] as { id: number } | undefined
  if (!tenant) {
    markStripeConnectEventProcessed(event.id)
    return NextResponse.json({ received: true }, { status: 200 })
  }

  const tenantId = tenant.id

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.paused' ||
    event.type === 'customer.subscription.resumed'
  ) {
    const obj = event.data?.object as {
      id?: string
      customer?: string | { id?: string }
      status?: string
      current_period_start?: number
      current_period_end?: number
      cancel_at?: number
      items?: { data?: Array<{ plan?: { product?: string } }> }
      metadata?: { lessonId?: string; lesson_id?: string; bookingIds?: string }
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
      const bookingIdsRaw = meta.bookingIds

      const confirmBookingAndCreateTransaction = async (
        bookingId: number,
        bkTenantId: number | undefined
      ) => {
        const hasTx = await payload.find({
          collection: 'transactions' as import('payload').CollectionSlug,
          where: { booking: { equals: bookingId } },
          limit: 1,
          overrideAccess: true,
        })
        if (hasTx.totalDocs === 0) {
          await payload.create({
            collection: 'transactions' as import('payload').CollectionSlug,
            data: {
              booking: bookingId,
              paymentMethod: 'subscription',
              subscriptionId: subId,
              ...(bkTenantId != null ? { tenant: bkTenantId } : {}),
            } as Record<string, unknown>,
            overrideAccess: true,
          })
        }
      }

      if (bookingIdsRaw) {
        const ids = bookingIdsRaw
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n))
        for (const id of ids) {
          try {
            const booking = (await payload.findByID({
              collection: 'bookings',
              id,
              depth: 1,
              overrideAccess: true,
            })) as { tenant?: number | { id: number } } | null
            if (!booking) continue
            await payload.update({
              collection: 'bookings',
              id,
              data: { status: 'confirmed' },
              overrideAccess: true,
            })
            const bkTenantId =
              booking?.tenant != null
                ? typeof booking.tenant === 'object' && 'id' in booking.tenant
                  ? booking.tenant.id
                  : (booking.tenant as number)
                : undefined
            await confirmBookingAndCreateTransaction(id, bkTenantId)
          } catch {
            payload.logger?.error?.(`Failed to confirm booking ${id} from subscription metadata`)
          }
        }
      } else if (lessonId) {
        const lessonIdNum = Number(lessonId)
        if (Number.isFinite(lessonIdNum)) {
          try {
            const lesson = (await payload.findByID({
              collection: 'lessons',
              id: lessonIdNum,
              depth: 1,
              overrideAccess: true,
            })) as { tenant?: number | { id: number } } | null
            const bookingQuery = await payload.find({
              collection: 'bookings',
              where: {
                user: { equals: user.id },
                lesson: { equals: lessonIdNum },
              },
              limit: 1,
              overrideAccess: true,
            })
            let bookingId: number
            if (bookingQuery.totalDocs === 0) {
              const createdBk = await payload.create({
                collection: 'bookings',
                draft: false,
                data: {
                  lesson: lessonIdNum,
                  user: user.id,
                  status: 'confirmed',
                  ...(tenantId != null ? { tenant: tenantId } : {}),
                },
                overrideAccess: true,
              })
              bookingId = createdBk.id as number
            } else {
              const existing = bookingQuery.docs[0]
              bookingId = existing?.id as number
              await payload.update({
                collection: 'bookings',
                id: bookingId,
                data: { status: 'confirmed' },
                overrideAccess: true,
              })
            }
            const bkTenantId =
              lesson?.tenant != null
                ? typeof lesson.tenant === 'object' && 'id' in lesson.tenant
                  ? lesson.tenant.id
                  : (lesson.tenant as number)
                : tenantId
            await confirmBookingAndCreateTransaction(bookingId, bkTenantId ?? undefined)
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

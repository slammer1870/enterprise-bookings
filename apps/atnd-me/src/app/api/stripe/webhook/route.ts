/**
 * Step 2.5 / 2.8 – Stripe Connect webhook (account.updated, account.application.deauthorized, payment_intent.succeeded).
 * Verifies signature, resolves tenant by account id or metadata, updates status/booking, enforces idempotency.
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

    if (tenant && typeFromMeta === 'class_pass_purchase' && !bookingIdFromMeta) {
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

    if (tenant && bookingIdFromMeta) {
      const paymentIntentId = typeof obj?.id === 'string' ? obj.id : undefined
      if (paymentIntentId) {
        await payload.create({
          collection: 'transactions' as import('payload').CollectionSlug,
          data: {
            booking: Number(bookingIdFromMeta),
            paymentMethod: 'stripe',
            stripePaymentIntentId: paymentIntentId,
            ...(tenant?.id ? { tenant: tenant.id } : {}),
          } as Record<string, unknown>,
          overrideAccess: true,
        })
      }
      await payload.update({
        collection: 'bookings',
        id: Number(bookingIdFromMeta),
        data: { status: 'confirmed' },
        overrideAccess: true,
      })
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
  const tenant = tenantResult.docs[0]
  if (!tenant) {
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

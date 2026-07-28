/**
 * Assign a class pass after a successful class_pass_purchase Checkout / PaymentIntent.
 * Used by payment_intent.succeeded and checkout.session.completed (zero-amount / 100% discount).
 */
import type { Payload } from 'payload'
import { resolveDaysUntilExpiration } from '@repo/bookings-payments'
import { handleClassPassGiftRemainder } from './checkout-gift-credit'

export type AssignClassPassFromPurchaseResult =
  | { assigned: true; classPassId: number | string; credits: number }
  | { assigned: false; reason: string }

function parsePositiveInt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return null
}

/** Coerce Payload/Postgres numeric fields that may arrive as number or numeric-string. */
function coerceCredits(quantity: unknown): number {
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    return quantity
  }
  if (typeof quantity === 'string' && quantity.trim()) {
    const n = Number(quantity)
    if (Number.isFinite(n)) return n
  }
  return 0
}

export async function assignClassPassFromPurchase(params: {
  payload: Payload
  tenantId: number
  metadata: Record<string, string | undefined>
  /** Stripe PaymentIntent id, or Checkout Session id when amount is €0 (no PI). */
  transactionId: string
  tenantContext?: { tenant: number } | null
  purchasedAt?: Date
}): Promise<AssignClassPassFromPurchaseResult> {
  const { payload, tenantId, metadata: meta, transactionId, tenantContext } = params
  const purchasedAt = params.purchasedAt ?? new Date()

  if (meta.type !== 'class_pass_purchase') {
    return { assigned: false, reason: 'not_class_pass_purchase' }
  }
  if (meta.bookingId) {
    return { assigned: false, reason: 'has_booking_id' }
  }

  const userId = parsePositiveInt(meta.userId)
  const classPassTypeId = parsePositiveInt(meta.classPassTypeId)
  if (userId == null || classPassTypeId == null) {
    payload.logger?.error?.(
      `class_pass_purchase: missing userId/classPassTypeId for transaction ${transactionId}`,
    )
    return { assigned: false, reason: 'missing_metadata' }
  }

  const existing = await payload.find({
    collection: 'class-passes' as import('payload').CollectionSlug,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { transactionId: { equals: transactionId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    return {
      assigned: true,
      classPassId: existing.docs[0].id as number | string,
      credits: coerceCredits((existing.docs[0] as { quantity?: unknown }).quantity),
    }
  }

  const classPassType = (await payload
    .findByID({
      collection: 'class-pass-types' as import('payload').CollectionSlug,
      id: classPassTypeId,
      depth: 0,
      overrideAccess: true,
      ...(tenantContext ? { context: tenantContext } : {}),
    })
    .catch(() => null)) as { quantity?: unknown; daysUntilExpiration?: unknown } | null

  const passCredits = coerceCredits(classPassType?.quantity)
  if (passCredits < 1) {
    payload.logger?.error?.(
      `class_pass_purchase: class-pass-type ${classPassTypeId} has invalid quantity (${String(classPassType?.quantity)}) for transaction ${transactionId}`,
    )
    return { assigned: false, reason: 'invalid_pass_credits' }
  }

  const daysUntilExpiration = resolveDaysUntilExpiration(classPassType ?? {})
  const expirationDate = new Date(purchasedAt)
  expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration)
  const expirationDateISO = expirationDate.toISOString()

  const created = await payload.create({
    collection: 'class-passes' as import('payload').CollectionSlug,
    draft: false,
    data: {
      user: userId,
      tenant: tenantId,
      type: classPassTypeId,
      quantity: passCredits,
      expirationDate: expirationDateISO,
      purchasedAt: purchasedAt.toISOString().slice(0, 10),
      status: 'active',
      transactionId,
    } as Record<string, unknown>,
    ...(tenantContext ? { context: tenantContext } : {}),
    overrideAccess: true,
  })

  payload.logger?.info?.(
    `class_pass_purchase: assigned pass ${created.id} (${passCredits} credits) to user ${userId} for transaction ${transactionId}`,
  )

  await handleClassPassGiftRemainder({
    payload,
    tenantId,
    userId,
    paymentIntentId: transactionId,
    metadata: meta,
  })

  return {
    assigned: true,
    classPassId: created.id as number | string,
    credits: passCredits,
  }
}

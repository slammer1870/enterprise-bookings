/**
 * Booking confirmation helpers for Stripe Connect webhooks.
 * Handles confirming bookings and creating transaction records.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PayloadLike = any

/** Extract tenant ID from a relationship (object or number). */
function getTenantId(doc: { tenant?: number | { id: number } } | null): number | undefined {
  if (!doc?.tenant) return undefined
  const t = doc.tenant
  return typeof t === 'object' && t !== null && 'id' in t ? t.id : (t as number)
}

/**
 * Confirm bookings by ID and create Stripe transaction records.
 * Used for payment_intent.succeeded when metadata contains explicit bookingIds.
 */
export async function confirmBookingsFromPaymentIntent(
  payload: PayloadLike,
  bookingIds: number[],
  opts: {
    paymentIntentId?: string
    tenantId: number
    tenantContext?: { tenant?: number } | null
  }
): Promise<void> {
  const tenantContext = opts.tenantContext ?? { tenant: opts.tenantId }
  for (const bookingId of bookingIds) {
    if (opts.paymentIntentId) {
      await payload.create({
        collection: 'transactions',
        data: {
          booking: bookingId,
          paymentMethod: 'stripe',
          stripePaymentIntentId: opts.paymentIntentId,
          tenant: opts.tenantId,
        },
        ...(tenantContext ? { context: tenantContext } : {}),
        overrideAccess: true,
      } as Record<string, unknown>)
    }
    await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: { status: 'confirmed' },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
    })
  }
}

/**
 * Confirm bookings from quantity-based flow (legacy: lessonId + userId + quantity, no explicit bookingIds).
 * Finds or creates pending bookings, confirms them, and creates transaction records.
 */
export async function confirmBookingsFromQuantityFlow(
  payload: PayloadLike,
  opts: {
    lessonId: number
    userId: number
    quantity: number
    paymentIntentId?: string
    tenantId: number
    tenantContext?: { tenant?: number } | null
  }
): Promise<void> {
  const tenantContext = opts.tenantContext ?? { tenant: opts.tenantId }
  const { lessonId, userId, quantity, paymentIntentId, tenantId } = opts
  const qty = Math.max(1, quantity)

  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
    overrideAccess: true,
  })) as { remainingCapacity?: number } | null

  const remainingCapacity =
    lesson && typeof lesson.remainingCapacity === 'number'
      ? Math.max(0, lesson.remainingCapacity)
      : 0

  const existing = await payload.find({
    collection: 'bookings',
    where: {
      lesson: { equals: lessonId },
      user: { equals: userId },
    },
    limit: qty * 2,
    depth: 0,
    overrideAccess: true,
    select: { id: true, status: true } as any,
  })

  const docs = existing.docs as { id: number; status?: string }[]
  const confirmed = docs.filter((b) => b.status === 'confirmed')
  const pending = docs.filter((b) => b.status !== 'confirmed')
  const needToConfirm = Math.max(0, qty - confirmed.length)
  const toConfirm = pending.slice(0, Math.min(needToConfirm, remainingCapacity))
  const toCreate = Math.max(
    0,
    Math.min(needToConfirm - toConfirm.length, remainingCapacity - toConfirm.length)
  )

  for (const b of toConfirm) {
    await payload.update({
      collection: 'bookings',
      id: b.id,
      data: { status: 'confirmed' },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
    })
    if (paymentIntentId) {
      await payload.create({
        collection: 'transactions',
        data: {
          booking: b.id,
          paymentMethod: 'stripe',
          stripePaymentIntentId: paymentIntentId,
          tenant: tenantId,
        },
        ...(tenantContext ? { context: tenantContext } : {}),
        overrideAccess: true,
      } as Record<string, unknown>)
    }
  }

  for (let i = 0; i < toCreate; i++) {
    const created = await payload.create({
      collection: 'bookings',
      data: {
        lesson: lessonId,
        user: userId,
        tenant: tenantId,
        status: 'confirmed',
      },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
    } as Record<string, unknown>)
    if (paymentIntentId && created?.id) {
      await payload.create({
        collection: 'transactions',
        data: {
          booking: created.id,
          paymentMethod: 'stripe',
          stripePaymentIntentId: paymentIntentId,
          tenant: tenantId,
        },
        ...(tenantContext ? { context: tenantContext } : {}),
        overrideAccess: true,
      } as Record<string, unknown>)
    }
  }
}

/**
 * Confirm a single booking and create a subscription transaction if none exists.
 * Used for customer.subscription.created when metadata contains bookingIds or lessonId.
 */
export async function confirmBookingAndCreateSubscriptionTransaction(
  payload: PayloadLike,
  bookingId: number,
  opts: {
    subscriptionId: number
    tenantId?: number
    tenantContext?: { tenant?: number } | null
  }
): Promise<void> {
  const tenantContext = opts.tenantContext ?? (opts.tenantId != null ? { tenant: opts.tenantId } : null)
  const existing = await payload.find({
    collection: 'transactions',
    where: { booking: { equals: bookingId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
    select: { id: true } as any,
  })

  if (existing.totalDocs === 0) {
    await payload.create({
      collection: 'transactions',
      data: {
        booking: bookingId,
        paymentMethod: 'subscription',
        subscriptionId: opts.subscriptionId,
        ...(opts.tenantId != null ? { tenant: opts.tenantId } : {}),
      },
      ...(tenantContext ? { context: tenantContext } : {}),
      overrideAccess: true,
    } as Record<string, unknown>)
  }
}

/**
 * Confirm bookings by ID from subscription metadata.
 * Fetches each booking to get tenant, confirms it, and creates transaction.
 */
export async function confirmBookingsFromSubscriptionMetadata(
  payload: PayloadLike,
  bookingIds: number[],
  subscriptionId: number
): Promise<void> {
  const tenantContext = (tenantId: number | undefined) =>
    tenantId != null ? { tenant: tenantId } : null
  for (const id of bookingIds) {
    try {
      const booking = (await payload.findByID({
        collection: 'bookings',
        id,
        depth: 1,
        overrideAccess: true,
        select: { tenant: true } as any,
      })) as { tenant?: number | { id: number } } | null

      if (!booking) continue
      const bookingTenantId = getTenantId(booking)
      const bookingTenantContext = tenantContext(bookingTenantId)

      await payload.update({
        collection: 'bookings',
        id,
        data: { status: 'confirmed' },
        ...(bookingTenantContext ? { context: bookingTenantContext } : {}),
        overrideAccess: true,
      })

      const ctx = bookingTenantContext
      await confirmBookingAndCreateSubscriptionTransaction(payload, id, {
        subscriptionId,
        tenantId: bookingTenantId,
        ...(ctx ? { tenantContext: ctx } : {}),
      })
    } catch {
      payload.logger?.error?.(`Failed to confirm booking ${id} from subscription metadata`)
    }
  }
}

/**
 * Find or create a booking for user+lesson, confirm it, and create subscription transaction.
 * Used when subscription metadata has lessonId but no explicit bookingIds.
 */
export async function findOrCreateAndConfirmBookingForLesson(
  payload: PayloadLike,
  opts: {
    lessonId: number
    userId: number
    tenantId: number
    subscriptionId: number
    tenantContext?: { tenant?: number } | null
  }
): Promise<void> {
  const { lessonId, userId, tenantId, subscriptionId } = opts
  const bookingTenantContext = opts.tenantContext ?? { tenant: tenantId }
  const lesson = (await payload.findByID({
    collection: 'lessons',
    id: lessonId,
    depth: 1,
    overrideAccess: true,
  })) as { tenant?: number | { id: number } } | null

  const existing = await payload.find({
    collection: 'bookings',
    where: {
      user: { equals: userId },
      lesson: { equals: lessonId },
    },
    limit: 1,
    overrideAccess: true,
  })

  let bookingId: number
  const bkTenantId = getTenantId(lesson) ?? tenantId

  if (existing.totalDocs === 0) {
    const created = await payload.create({
      collection: 'bookings',
      draft: false,
      data: {
        lesson: lessonId,
        user: userId,
        status: 'confirmed',
        tenant: tenantId,
      },
      ...(bookingTenantContext ? { context: bookingTenantContext } : {}),
      overrideAccess: true,
    } as Record<string, unknown>)
    bookingId = created.id
  } else {
    const doc = existing.docs[0] as { id: number }
    bookingId = doc.id
    await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: { status: 'confirmed' },
      ...(bookingTenantContext ? { context: bookingTenantContext } : {}),
      overrideAccess: true,
    })
  }

  await confirmBookingAndCreateSubscriptionTransaction(payload, bookingId, {
    subscriptionId,
    tenantId: bkTenantId,
    tenantContext: { tenant: bkTenantId },
  })
}

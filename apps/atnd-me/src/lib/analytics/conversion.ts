export type AnalyticsBookingFlow =
  | 'checkout'
  | 'new'
  | 'manage'
  | 'event'
  | 'course'

export type VerifiedConversion = {
  eventName: 'Booking Completed' | 'Course Purchased'
  bookingFlow: AnalyticsBookingFlow
  quantity: number
  isTrial: boolean
  paymentMethod: 'card' | 'membership' | 'class_pass' | 'pay_at_door' | 'free'
  revenue?: { amount: number; currency: string }
}

type SucceededPaymentIntentLike = {
  amount: number
  currency: string
  metadata?: Record<string, string>
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function receiptPaymentMethodForAnalytics(input: {
  paymentMethod: 'stripe' | 'pay_at_door' | 'subscription' | 'class_pass'
  amountPaidCents: number | null
}): VerifiedConversion['paymentMethod'] {
  if (input.paymentMethod === 'stripe') {
    return input.amountPaidCents === 0 ? 'free' : 'card'
  }
  if (input.paymentMethod === 'subscription') return 'membership'
  return input.paymentMethod
}

export function paymentIntentConversion(input: {
  paymentIntent: SucceededPaymentIntentLike | null
  tenantId: number
  viewerUserId?: number
  requireGuestCheckout?: boolean
}): VerifiedConversion | null {
  const { paymentIntent, tenantId, viewerUserId, requireGuestCheckout = false } = input
  if (!paymentIntent) return null

  const metadataTenantId = parsePositiveInteger(paymentIntent.metadata?.tenantId)
  if (metadataTenantId !== tenantId) return null
  if (requireGuestCheckout && paymentIntent.metadata?.guestCheckout !== 'true') return null

  const metadataUserId = parsePositiveInteger(paymentIntent.metadata?.userId)
  if (viewerUserId != null && metadataUserId !== viewerUserId) return null

  const isCourse = paymentIntent.metadata?.type === 'course_purchase'
  const isEvent =
    requireGuestCheckout ||
    paymentIntent.metadata?.eventCheckout === 'true' ||
    paymentIntent.metadata?.guestCheckout === 'true'
  const quantity = Math.max(
    1,
    parsePositiveInteger(paymentIntent.metadata?.quantity) ?? 1,
  )

  return {
    eventName: isCourse ? 'Course Purchased' : 'Booking Completed',
    bookingFlow: isCourse ? 'course' : isEvent ? 'event' : 'checkout',
    quantity: isCourse ? 1 : quantity,
    isTrial: false,
    paymentMethod: 'card',
    revenue:
      paymentIntent.amount > 0
        ? {
            amount: Number((paymentIntent.amount / 100).toFixed(2)),
            currency: paymentIntent.currency.toUpperCase(),
          }
        : undefined,
  }
}

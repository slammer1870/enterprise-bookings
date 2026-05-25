import type { CollectionSlug } from 'payload'

/** Active checkout reservation window (refreshed on upsert / extend). */
export const HOLD_TTL_MS = 5 * 60 * 1000

/** Grace after expiry where webhook fulfillment may still succeed if capacity allows. */
export const HOLD_FULFILLMENT_GRACE_MS = 60 * 1000

/** Maximum total hold lifetime from first upsert (pay-click extensions included). */
export const HOLD_MAX_LIFETIME_MS = 15 * 60 * 1000

export const CHECKOUT_HOLD_COLLECTION_SLUG = 'booking-checkout-holds' as CollectionSlug

export const BOOKINGS_COLLECTION_SLUG = 'bookings' as CollectionSlug
export const TIMESLOTS_COLLECTION_SLUG = 'timeslots' as CollectionSlug
export const EVENT_TYPES_COLLECTION_SLUG = 'event-types' as CollectionSlug
export const TRANSACTIONS_COLLECTION_SLUG = 'transactions' as CollectionSlug

export const CHECKOUT_HOLD_STATUSES = ['active', 'consumed', 'expired'] as const
export type CheckoutHoldStatus = (typeof CHECKOUT_HOLD_STATUSES)[number]

/**
 * Idempotency for Stripe Connect webhook events (step 2.5).
 * In-memory store per process; production should use a DB-backed store.
 * Callers can mock this in tests.
 */
const processedIds = new Set<string>()

export function hasProcessedStripeConnectEvent(eventId: string): boolean {
  return processedIds.has(eventId)
}

export function markStripeConnectEventProcessed(eventId: string): void {
  processedIds.add(eventId)
}

/** Reset store (for tests only). */
export function resetProcessedStripeConnectEvents(): void {
  processedIds.clear()
}

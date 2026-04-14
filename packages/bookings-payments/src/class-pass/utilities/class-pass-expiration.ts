/** Fallback when class pass type has no valid daysUntilExpiration (legacy rows). */
export const DEFAULT_CLASS_PASS_EXPIRATION_DAYS = 365;

export function resolveDaysUntilExpiration(classPassType: {
  daysUntilExpiration?: unknown;
}): number {
  const n = classPassType.daysUntilExpiration;
  if (typeof n === "number" && Number.isFinite(n) && n >= 1) {
    return Math.floor(n);
  }
  return DEFAULT_CLASS_PASS_EXPIRATION_DAYS;
}

/** Same calendar-day arithmetic as Stripe webhook class-pass creation (local setDate, ISO date slice). */
export function classPassExpirationDateOnly(purchasedAt: Date, daysUntilExpiration: number): string {
  const expirationDate = new Date(purchasedAt);
  expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);
  return expirationDate.toISOString().slice(0, 10);
}

/**
 * The viewer's active checkout hold as the booking UI stores it.
 * Global remaining capacity already subtracts this quantity.
 */
export type ViewerCheckoutHold = {
  id: number;
  quantity: number;
  expiresAt: string;
};

/**
 * Max places this viewer can book.
 *
 * `remainingCapacity` already subtracts every active hold, including this viewer's.
 * Add their hold back. Someone else's hold stays inside `remainingCapacity`.
 * A booking quantity is at least 1.
 */
export function maxBookableQuantity(
  remainingCapacity: unknown,
  ownHoldQuantity: unknown,
): number {
  const remaining = Math.max(0, Number(remainingCapacity) || 0);
  const ownHold = Math.max(0, Number(ownHoldQuantity) || 0);
  return Math.max(1, remaining + ownHold || 1);
}

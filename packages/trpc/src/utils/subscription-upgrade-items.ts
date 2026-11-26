import type Stripe from "stripe";

/** Platform fee line items are created as ad-hoc "Platform fee" products on Connect checkout. */
export function isStripePlatformFeeSubscriptionItem(
  item: Pick<Stripe.SubscriptionItem, "price">,
): boolean {
  const product = item.price?.product;
  if (product && typeof product === "object" && !("deleted" in product && product.deleted)) {
    return (product as Stripe.Product).name === "Platform fee";
  }
  return false;
}

/**
 * Pick the plan line item to swap on upgrade.
 * Prefer a non-fee item; fall back to the first item.
 */
export function selectPlanSubscriptionItem(
  items: Stripe.SubscriptionItem[],
): Stripe.SubscriptionItem | null {
  if (items.length === 0) return null;
  return items.find((item) => !isStripePlatformFeeSubscriptionItem(item)) ?? items[0] ?? null;
}

export function selectPlatformFeeSubscriptionItems(
  items: Stripe.SubscriptionItem[],
): Stripe.SubscriptionItem[] {
  return items.filter(isStripePlatformFeeSubscriptionItem);
}

/**
 * Build Stripe `subscriptions.update` items for a Connect membership that may include
 * a recurring Platform fee line item (Billing Portal cannot update multi-item subs).
 */
export function buildMultiItemSubscriptionUpgradeItems(params: {
  items: Stripe.SubscriptionItem[];
  newPlanPriceId: string;
  /** New Platform fee Stripe price id, or null to remove fee items. */
  newFeePriceId: string | null;
}): Stripe.SubscriptionUpdateParams.Item[] {
  const { items, newPlanPriceId, newFeePriceId } = params;
  const planItem = selectPlanSubscriptionItem(items);
  const feeItems = selectPlatformFeeSubscriptionItems(items);
  if (!planItem) {
    throw new Error("Subscription has no items to upgrade");
  }

  const updates: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: planItem.id, price: newPlanPriceId },
  ];

  if (feeItems.length === 0) {
    if (newFeePriceId) {
      updates.push({ price: newFeePriceId, quantity: 1 });
    }
    return updates;
  }

  const primaryFee = feeItems[0]!;
  const extraFees = feeItems.slice(1);
  if (newFeePriceId) {
    updates.push({ id: primaryFee.id, price: newFeePriceId });
  } else {
    updates.push({ id: primaryFee.id, deleted: true });
  }
  for (const extra of extraFees) {
    updates.push({ id: extra.id, deleted: true });
  }
  return updates;
}

/** Exact application_fee_percent that yields feeCents of totalCents (Connect). */
export function findExactApplicationFeePercent(params: {
  feeCents: number;
  totalCents: number;
}): number | null {
  const { feeCents, totalCents } = params;
  if (!Number.isFinite(feeCents) || !Number.isFinite(totalCents)) return null;
  if (feeCents <= 0 || totalCents <= 0) return null;

  const twoTotal = 2 * totalCents;
  const bpMin = Math.ceil(((2 * feeCents - 1) * 10000) / twoTotal);
  const bpMax = Math.floor(((2 * feeCents + 1) * 10000 - 1) / twoTotal);
  if (bpMin > bpMax) return null;

  const rounded = Math.round((feeCents / totalCents) * 10000);
  const candidate = Math.min(bpMax, Math.max(bpMin, rounded));
  const computed = Math.round((totalCents * candidate) / 10000);
  if (computed !== feeCents) return null;
  return candidate / 100;
}

import { DiscountTier, DiscountResult } from "@repo/shared-types";
/**
 * Calculates quantity-based discounts for drop-in classes
 *
 * @param price - The original unit price
 * @param quantity - The quantity being purchased
 * @param priceType - The type of price ('normal' or 'trial')
 * @param discountTiers - Array of discount tiers with minQuantity and discountPercent
 * @returns Object containing pricing details and discount information
 */
export const calculateQuantityDiscount = (
  price: number,
  quantity: number = 1,
  discountTiers?: DiscountTier[],
  trialable?: boolean
): DiscountResult => {
  // Default values if no discount applies
  let discountedPrice = price;
  let totalAmountBeforeDiscount = price * quantity;
  let totalAmount = price * quantity;
  let discountApplied = false;
  let appliedDiscountPercent: number | undefined = undefined;

  // Only apply discounts for normal price type with valid discount tiers
  if (
    quantity >= 1 &&
    Array.isArray(discountTiers) &&
    discountTiers.length > 0
  ) {
    // Sort discount tiers by minQuantity in descending order to get the highest applicable discount
    const sortedTiers = [...discountTiers].sort(
      (a, b) => b.minQuantity - a.minQuantity
    );

    // Find the first tier where quantity meets or exceeds minQuantity
    const applicableTier = sortedTiers.find(
      (tier) => quantity >= tier.minQuantity
    );

    if (
      applicableTier &&
      (applicableTier.type === "normal" ||
        (trialable && applicableTier.type === "trial")) &&
      applicableTier.discountPercent > 0
    ) {
      const discountMultiplier = (100 - applicableTier.discountPercent) / 100;
      discountedPrice = price * discountMultiplier;
      totalAmount = discountedPrice * quantity;
      discountApplied = true;
      appliedDiscountPercent = applicableTier.discountPercent;
    }
  }

  // Round monetary values to 2 decimal places
  discountedPrice = Number(discountedPrice.toFixed(2));
  totalAmountBeforeDiscount = Number(totalAmountBeforeDiscount.toFixed(2));
  totalAmount = Number(totalAmount.toFixed(2));

  return {
    originalPrice: price,
    discountedPrice,
    totalAmountBeforeDiscount,
    totalAmount,
    discountApplied,
    ...(discountApplied ? { appliedDiscountPercent } : {}),
  };
};

export type PromoDiscount = {
  type: "percentage_off" | "amount_off";
  value: number;
  currency?: string | null;
};

/**
 * Applies a checkout promo code on top of an already-tiered amount (euros).
 * Percentage off uses `value` 1–100. Amount off uses `value` in euros (EUR only).
 */
export function applyPromoDiscount(params: {
  amount: number;
  discount?: PromoDiscount | null;
}): {
  amount: number;
  promoDiscountAmount: number;
  discountApplied: boolean;
} {
  const { amount, discount } = params;
  if (!discount || amount <= 0) {
    return { amount, promoDiscountAmount: 0, discountApplied: false };
  }

  let promoDiscountAmount = 0;
  if (discount.type === "percentage_off") {
    promoDiscountAmount = Number(((amount * discount.value) / 100).toFixed(2));
  } else if (
    discount.type === "amount_off" &&
    (!discount.currency || discount.currency.toLowerCase() === "eur")
  ) {
    promoDiscountAmount = discount.value;
  }

  promoDiscountAmount = Math.max(
    0,
    Math.min(amount, Number(promoDiscountAmount.toFixed(2))),
  );

  return {
    amount: Number((amount - promoDiscountAmount).toFixed(2)),
    promoDiscountAmount,
    discountApplied: promoDiscountAmount > 0,
  };
}

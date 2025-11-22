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

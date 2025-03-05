export type DiscountTier = {
  minQuantity: number;
  discountPercent: number;
  type: "normal" | "trial" ;
};

export type DiscountResult = {
  originalPrice: number;
  discountedPrice: number;
  totalAmount: number;
  discountApplied: boolean;
  appliedDiscountPercent?: number;
};

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
  discountTiers?: DiscountTier[]
): DiscountResult => {
  // Default values if no discount applies
  let discountedPrice = price;
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

    if (applicableTier && applicableTier.type === "normal") {
      const discountMultiplier = (100 - applicableTier.discountPercent) / 100;
      discountedPrice = price * discountMultiplier;
      totalAmount = discountedPrice * quantity;
      discountApplied = true;
      appliedDiscountPercent = applicableTier.discountPercent;
    }
  }

  return {
    originalPrice: price,
    discountedPrice,
    totalAmount,
    discountApplied,
    ...(discountApplied ? { appliedDiscountPercent } : {}),
  };
};

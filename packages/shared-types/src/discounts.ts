export type DiscountTier = {
  minQuantity: number;
  discountPercent: number;
  type: "normal" | "trial";
};

export type DiscountResult = {
  originalPrice: number;
  discountedPrice: number;
  totalAmountBeforeDiscount: number;
  totalAmount: number;
  discountApplied: boolean;
  appliedDiscountPercent?: number;
};

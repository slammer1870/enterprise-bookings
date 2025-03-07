import { useState } from "react";
import { calculateQuantityDiscount } from "../utils/discount";
import { DiscountTier } from "@repo/shared-types";

interface UsePaymentOptions {
  basePrice: number;
  discountTiers: DiscountTier[];
}

export function usePayment({ basePrice, discountTiers }: UsePaymentOptions) {
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [loading, setLoading] = useState(false);

  const calculatePrice = (quantity: number) => {
    return calculateQuantityDiscount(basePrice, quantity, discountTiers);
  };

  return {
    paymentMethod,
    setPaymentMethod,
    loading,
    setLoading,
    calculatePrice,
  };
}

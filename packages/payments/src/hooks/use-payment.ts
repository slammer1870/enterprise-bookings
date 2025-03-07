import { useState } from "react";
import { calculateQuantityDiscount } from "../utils/discount";
import { DiscountTier } from "@repo/shared-types";

interface UsePaymentOptions {
  basePrice: number;
  discountTiers: DiscountTier[];
  paymentMethods: string[];
}

export function usePayment({
  basePrice,
  discountTiers,
  paymentMethods,
}: UsePaymentOptions) {
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
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

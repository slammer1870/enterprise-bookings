"use client";

import { useState } from "react";
import { calculateQuantityDiscount } from "@repo/shared-utils";
import { DiscountResult, DiscountTier } from "@repo/shared-types";

interface UsePaymentOptions {
  basePrice: number;
  discountTiers: DiscountTier[];
  paymentMethods: string[];
  quantity?: number;
  trialable?: boolean;
}

export function usePayment({
  basePrice,
  discountTiers,
  paymentMethods,
  quantity = 1,
  trialable = false,
}: UsePaymentOptions) {
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [loading, setLoading] = useState(false);

  const calculatePrice = (quantity: number) => {
    return calculateQuantityDiscount(basePrice, quantity, discountTiers);
  };

  const price = calculateQuantityDiscount(
    basePrice,
    quantity,
    discountTiers,
    trialable
  );

  return {
    paymentMethod,
    setPaymentMethod,
    loading,
    setLoading,
    calculatePrice,
    price,
  };
}


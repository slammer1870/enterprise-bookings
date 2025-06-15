"use client";

import { Lesson } from "@repo/shared-types";
import { usePayment } from "../../hooks/use-payment";

export const DropInView = ({ lesson }: { lesson: Lesson }) => {
  const {
    paymentMethod,
    setPaymentMethod,
    loading,
    setLoading,
    calculatePrice,
    price,
  } = usePayment({
    basePrice: lesson.classOption.paymentMethods?.allowedDropIn?.price || 0,
    discountTiers:
      lesson.classOption.paymentMethods?.allowedDropIn?.discountTiers || [],
    paymentMethods:
      lesson.classOption.paymentMethods?.allowedDropIn?.paymentMethods || [],
    trialable: lesson.bookingStatus === "trialable",
  });

  return (
    <div>
      <div>
        <h1>Drop-in</h1>
        <div className="flex justify-between items-center text-lg font-semibold">
          <span>Total</span>
          <div className="flex items-center gap-2">
            {price.discountApplied && (
              <span className="line-through text-red-400">
                €{price.totalAmountBeforeDiscount.toFixed(2)}
              </span>
            )}
            <span>€{price.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

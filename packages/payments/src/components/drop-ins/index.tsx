"use client";

import { Lesson } from "@repo/shared-types";
import { usePayment } from "../../hooks/use-payment";

import CheckoutForm from "../checkout-form";

import { PriceView } from "./price";

export const DropInView = ({
  lesson,
  quantity,
  metadata,
}: {
  lesson: Lesson;
  quantity?: number;
  metadata?: Record<string, string>;
}) => {
  const { price } = usePayment({
    basePrice: lesson.classOption.paymentMethods?.allowedDropIn?.price || 0,
    discountTiers:
      lesson.classOption.paymentMethods?.allowedDropIn?.discountTiers || [],
    paymentMethods:
      lesson.classOption.paymentMethods?.allowedDropIn?.paymentMethods || [],
    trialable: lesson.bookingStatus === "trialable",
    quantity: quantity || 1,
  });

  return (
    <div>
      <CheckoutForm
        price={price.totalAmount}
        priceComponent={<PriceView price={price} />}
        metadata={{
          lessonId: lesson.id.toString(),
          ...metadata,
        }}
      />
    </div>
  );
};

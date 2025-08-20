"use client";

import { DropIn, Lesson } from "@repo/shared-types";
import { usePayment } from "../../hooks/use-payment";

import CheckoutForm from "../checkout-form";

import { PriceView } from "./price";

export const DropInView = ({
  bookingStatus,
  dropIn,
  quantity,
  metadata,
}: {
  bookingStatus: Lesson["bookingStatus"];
  dropIn: DropIn;
  quantity?: number;
  metadata?: Record<string, string>;
}) => {
  console.log(dropIn);

  // Add safety check for undefined dropIn
  if (!dropIn) {
    console.error("DropInView: dropIn is undefined");
    return <div>Drop-in payment option is not available</div>;
  }

  const { price } = usePayment({
    basePrice: dropIn.price,
    discountTiers: dropIn.discountTiers || [],
    paymentMethods: dropIn.paymentMethods || [],
    trialable: bookingStatus === "trialable" ? true : false,
    quantity: quantity || 1,
  });

  return (
    <div>
      {bookingStatus === "trialable" && (
        <span className="text-sm text-gray-500 my-2">
          Since this is a trial class you will recieve a discount on your first
          payment.
        </span>
      )}
      <CheckoutForm
        price={price.totalAmount}
        priceComponent={<PriceView price={price} />}
        metadata={metadata}
      />
    </div>
  );
};

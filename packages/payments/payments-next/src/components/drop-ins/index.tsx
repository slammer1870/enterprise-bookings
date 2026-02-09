"use client";

import { useEffect, useState } from "react";
import { DropIn, Lesson } from "@repo/shared-types";
import { usePayment } from "../../hooks/use-payment";

import CheckoutForm from "../checkout-form";

import { PriceView } from "./price";

export const DropInView = ({
  bookingStatus,
  dropIn,
  quantity,
  metadata,
  createPaymentIntentUrl,
}: {
  bookingStatus: Lesson["bookingStatus"];
  dropIn: DropIn | number;
  quantity?: number;
  metadata?: Record<string, string>;
  createPaymentIntentUrl?: string;
}) => {
  const [dropInDoc, setDropInDoc] = useState<DropIn | null>(
    dropIn && typeof dropIn === "object" ? (dropIn as DropIn) : null
  );
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!dropIn) return;
    if (typeof dropIn === "object") {
      setDropInDoc(dropIn as DropIn);
      setLoadError(false);
      return;
    }
    // `allowedDropIn` can arrive as an ID depending on Payload depth/maxDepth.
    // Fetch the full doc so we can render pricing + discount tiers.
    let cancelled = false;
    setDropInDoc(null);
    setLoadError(false);
    fetch(`/api/drop-ins/${dropIn}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("drop-in fetch failed"))))
      .then((data) => {
        if (cancelled) return;
        setDropInDoc(data as DropIn);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dropIn]);

  if (!dropIn || loadError) {
    return <div>Drop-in payment option is not available</div>;
  }

  if (!dropInDoc) {
    return <div>Loading drop-in payment option…</div>;
  }

  const { price } = usePayment({
    basePrice: dropInDoc.price,
    discountTiers: dropInDoc.discountTiers || [],
    paymentMethods: dropInDoc.paymentMethods || [],
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
        createPaymentIntentUrl={createPaymentIntentUrl}
      />
    </div>
  );
};


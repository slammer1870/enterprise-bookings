"use client";

import { useEffect, useState } from "react";
import { DropIn, Lesson } from "@repo/shared-types";
import { usePayment } from "../../hooks/use-payment";

import CheckoutForm from "../checkout-form";

import { PriceView } from "./price";

/**
 * Optional component to render fee breakdown (class price, booking fee, total).
 * Receives classPriceCents (drop-in total in cents) and lessonId for fee lookup.
 */
export type FeeBreakdownComponentProps = {
  classPriceCents: number;
  lessonId: number;
};

export const DropInView = ({
  bookingStatus,
  dropIn,
  quantity,
  metadata,
  createPaymentIntentUrl,
  FeeBreakdownComponent,
}: {
  bookingStatus: Lesson["bookingStatus"];
  dropIn: DropIn | number;
  quantity?: number;
  metadata?: Record<string, string>;
  createPaymentIntentUrl?: string;
  /** Optional: render fee breakdown (class price + booking fee + total) when drop-in has platform fee */
  FeeBreakdownComponent?: React.ComponentType<FeeBreakdownComponentProps>;
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

  // Convert totalAmount to cents for fee breakdown (totalAmount is in currency units, e.g. euros)
  const classPriceCents = Math.round(price.totalAmount * 100);
  const lessonId = metadata?.lessonId ? parseInt(metadata.lessonId, 10) : null;

  return (
    <div>
      {FeeBreakdownComponent && lessonId != null && !Number.isNaN(lessonId) && (
        <div className="mb-4">
          <FeeBreakdownComponent classPriceCents={classPriceCents} lessonId={lessonId} />
        </div>
      )}
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


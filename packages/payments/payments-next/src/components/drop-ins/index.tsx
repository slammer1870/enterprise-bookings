"use client";

import { useEffect, useState } from "react";
import { DropIn, Lesson } from "@repo/shared-types";
import { useTRPC } from "@repo/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { usePayment } from "../../hooks/use-payment";

import CheckoutForm from "../checkout-form";

import { PriceView } from "./price";

type FeeBreakdownData = {
  classPriceCents: number;
  originalClassPriceCents?: number;
  promoDiscountCents?: number;
  bookingFeeCents: number;
  totalCents: number;
};

type AppliedDiscount = {
  code: string;
  type: "percentage_off" | "amount_off";
  value: number;
  currency?: string | null;
};

function applyPromoDiscount(params: {
  amount: number;
  discount?: AppliedDiscount;
}) {
  const { amount, discount } = params;
  if (!discount || amount <= 0) {
    return {
      amount,
      promoDiscountAmount: 0,
      discountApplied: false,
    };
  }

  let promoDiscountAmount = 0;
  if (discount.type === "percentage_off") {
    promoDiscountAmount = Number(((amount * discount.value) / 100).toFixed(2));
  } else if (
    discount.type === "amount_off" &&
    (!discount.currency || discount.currency.toLowerCase() === "eur")
  ) {
    promoDiscountAmount = discount.value;
  }

  promoDiscountAmount = Math.max(0, Math.min(amount, Number(promoDiscountAmount.toFixed(2))));

  return {
    amount: Number((amount - promoDiscountAmount).toFixed(2)),
    promoDiscountAmount,
    discountApplied: promoDiscountAmount > 0,
  };
}

/** Renders checkout form with fee-inclusive total when getDropInFeeBreakdown exists. */
function DropInCheckoutWithFee({
  classPriceAmount,
  priceComponent,
  metadata,
  createPaymentIntentUrl,
  FeeBreakdownComponent: _FeeBreakdownComponent,
  lessonId,
  onPaymentRedirectStart,
  returnUrl,
}: {
  classPriceAmount: number;
  priceComponent: React.ReactNode;
  metadata?: Record<string, string>;
  createPaymentIntentUrl?: string;
  FeeBreakdownComponent?: React.ComponentType<{ classPriceCents: number; lessonId: number }>;
  lessonId: number;
  onPaymentRedirectStart?: () => void;
  returnUrl?: string;
}) {
  const trpc = useTRPC();
  const procedure = (trpc.payments as { getDropInFeeBreakdown?: { queryOptions: (_opts: { lessonId: number; classPriceCents: number }) => object } })?.getDropInFeeBreakdown;
  const classPriceCents = Math.round(classPriceAmount * 100);

  const { data } = useQuery({
    ...(procedure?.queryOptions({ lessonId, classPriceCents }) ?? {
      queryKey: ["drop-in-fee", lessonId, classPriceCents],
      queryFn: (): FeeBreakdownData | null => null,
      enabled: false,
    }),
  } as { queryKey: unknown[]; queryFn: () => FeeBreakdownData | null; enabled?: boolean });

  const totalCents = (data as FeeBreakdownData | undefined)?.totalCents;
  const displayComponent =
    totalCents != null ? (
      <div className="flex justify-start items-center text-lg font-medium my-4 gap-4">
        <span className="font-semibold">Total:</span>
        <span data-testid="payment-total">€{(totalCents / 100).toFixed(2)}</span>
      </div>
    ) : (
      priceComponent
    );

  return (
    <CheckoutForm
      price={classPriceAmount}
      priceComponent={displayComponent}
      metadata={metadata}
      createPaymentIntentUrl={createPaymentIntentUrl}
      onPaymentRedirectStart={onPaymentRedirectStart}
      returnUrl={returnUrl}
    />
  );
}

/**
 * Optional component to render fee breakdown (class price, booking fee, total).
 * Receives classPriceCents (drop-in total in cents) and lessonId for fee lookup.
 */
export type FeeBreakdownComponentProps = {
  classPriceCents: number;
  lessonId: number;
  originalClassPriceCents?: number;
  promoDiscountCents?: number;
  discountCode?: string;
};

export const DropInView = ({
  bookingStatus,
  dropIn,
  quantity,
  discountCode,
  discount,
  metadata,
  onPaymentRedirectStart,
  createPaymentIntentUrl,
  FeeBreakdownComponent,
  returnUrl,
}: {
  bookingStatus: Lesson["bookingStatus"];
  dropIn: DropIn | number;
  quantity?: number;
  discountCode?: string;
  discount?: AppliedDiscount;
  metadata?: Record<string, string>;
  /** Called when user starts payment redirect (e.g. to Stripe) so parent can avoid cancelling pending bookings */
  onPaymentRedirectStart?: () => void;
  createPaymentIntentUrl?: string;
  /** Optional: render fee breakdown (class price + booking fee + total) when drop-in has platform fee */
  FeeBreakdownComponent?: React.ComponentType<FeeBreakdownComponentProps>;
  /** URL to redirect to after successful payment. Defaults to /dashboard for backwards compatibility. */
  returnUrl?: string;
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

  const promoAdjusted = applyPromoDiscount({
    amount: price.totalAmount,
    discount,
  });
  const displayPrice = promoAdjusted.discountApplied
    ? {
        ...price,
        totalAmountBeforeDiscount: price.totalAmount,
        totalAmount: promoAdjusted.amount,
        discountApplied: true,
      }
    : price;

  // Convert totalAmount to cents for fee breakdown (totalAmount is in currency units, e.g. euros)
  const classPriceCents = Math.round(displayPrice.totalAmount * 100);
  const originalClassPriceCents = Math.round(price.totalAmount * 100);
  const promoDiscountCents = Math.round(promoAdjusted.promoDiscountAmount * 100);
  const lessonId = metadata?.lessonId ? parseInt(metadata.lessonId, 10) : null;

  const lessonIdNum =
    lessonId != null && !Number.isNaN(lessonId) ? lessonId : null;

  return (
    <div>
      {FeeBreakdownComponent && lessonIdNum != null && (
        <div className="mb-4">
          <FeeBreakdownComponent
            classPriceCents={classPriceCents}
            lessonId={lessonIdNum}
            originalClassPriceCents={promoDiscountCents > 0 ? originalClassPriceCents : undefined}
            promoDiscountCents={promoDiscountCents > 0 ? promoDiscountCents : undefined}
            discountCode={discountCode}
          />
        </div>
      )}
      {bookingStatus === "trialable" && (
        <span className="text-sm text-gray-500 my-2">
          Since this is a trial class you will recieve a discount on your first
          payment.
        </span>
      )}
      {lessonIdNum != null && FeeBreakdownComponent ? (
        <DropInCheckoutWithFee
          classPriceAmount={displayPrice.totalAmount}
          priceComponent={<PriceView price={displayPrice} />}
          metadata={{
            ...(metadata ?? {}),
            ...(discountCode ? { discountCode } : {}),
          }}
          createPaymentIntentUrl={createPaymentIntentUrl}
          FeeBreakdownComponent={FeeBreakdownComponent}
          lessonId={lessonIdNum}
          onPaymentRedirectStart={onPaymentRedirectStart}
          returnUrl={returnUrl}
        />
      ) : (
        <CheckoutForm
          price={displayPrice.totalAmount}
          priceComponent={<PriceView price={displayPrice} />}
          metadata={{
            ...(metadata ?? {}),
            ...(discountCode ? { discountCode } : {}),
          }}
          createPaymentIntentUrl={createPaymentIntentUrl}
          onPaymentRedirectStart={onPaymentRedirectStart}
          returnUrl={returnUrl}
        />
      )}
    </div>
  );
};


"use client";

import { useMemo, type ComponentProps } from "react";
import { PaymentMethods, type CheckoutLegalConfig } from "@repo/payments-next";
import { DropInFeeBreakdown } from "./DropInFeeBreakdown.client";
import { ClassPassFeeBreakdown } from "./ClassPassFeeBreakdown.client";

type LegalPage =
  | number
  | { slug?: string | null; title?: string | null }
  | null
  | undefined;

function linkFromPage(page: LegalPage, origin: string) {
  if (!page || typeof page === "number") return undefined;
  const slug = typeof page.slug === "string" ? page.slug.trim() : "";
  const title = typeof page.title === "string" ? page.title.trim() : "";
  if (!slug || !title) return undefined;
  const base = origin.replace(/\/$/, "");
  return { label: title, href: `${base}/${slug}` };
}

function resolveCheckoutLegal(
  tenant: {
    checkoutLegalDocuments?: Array<{ page?: LegalPage }> | null;
  } | null | undefined,
  origin: string,
): CheckoutLegalConfig | undefined {
  const links = (tenant?.checkoutLegalDocuments ?? [])
    .map((doc) => linkFromPage(doc.page, origin))
    .filter((link): link is NonNullable<typeof link> => Boolean(link));

  return links.length > 0 ? { links } : undefined;
}

/**
 * atnd-me routes PaymentIntents through a Connect-aware endpoint.
 * Includes fee breakdown (class price, booking fee, total) for drop-in and class pass payments.
 * Redirects to /success after payment (receipt page) instead of /dashboard.
 */
export function PaymentMethodsConnect(props: ComponentProps<typeof PaymentMethods>) {
  const checkoutLegal = useMemo(() => {
    const tenant = props.timeslot?.tenant;
    if (typeof tenant !== "object" || tenant == null) return undefined;

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SERVER_URL || "";

    return resolveCheckoutLegal(
      tenant as { checkoutLegalDocuments?: Array<{ page?: LegalPage }> | null },
      origin,
    );
  }, [props.timeslot?.tenant]);

  return (
    <PaymentMethods
      {...props}
      checkoutLegal={checkoutLegal}
      createPaymentIntentUrl="/api/stripe/connect/create-payment-intent"
      createCheckoutSessionUrl="/api/stripe/connect/create-checkout-session"
      validateDiscountCodeUrl="/api/stripe/connect/validate-discount-code"
      FeeBreakdownComponent={DropInFeeBreakdown}
      ClassPassFeeBreakdownComponent={ClassPassFeeBreakdown}
      successUrl={props.successUrl ?? "/success"}
    />
  );
}

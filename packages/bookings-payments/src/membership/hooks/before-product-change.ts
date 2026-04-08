import type { CollectionBeforeChangeHook } from "payload";
import type Stripe from "stripe";
import { stripe } from "@repo/shared-utils";

const logs = true;

export const beforeProductChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  const { payload } = req;
  const newDoc: Record<string, unknown> = data;
  if (req.context?.skipStripeSync) {
    if (logs) payload.logger?.info?.("Skipping product 'beforeChange' hook via request context");
    return newDoc;
  }
  const stripeProductId =
    typeof data.stripeProductId === "string" && data.stripeProductId.trim().length > 0
      ? data.stripeProductId.trim()
      : originalDoc &&
          typeof originalDoc === "object" &&
          typeof (originalDoc as Record<string, unknown>).stripeProductId === "string" &&
          ((originalDoc as Record<string, unknown>).stripeProductId as string).trim().length > 0
        ? ((originalDoc as Record<string, unknown>).stripeProductId as string).trim()
        : null;
  const originalStripeProductId =
    originalDoc &&
    typeof originalDoc === "object" &&
    typeof (originalDoc as Record<string, unknown>).stripeProductId === "string" &&
    ((originalDoc as Record<string, unknown>).stripeProductId as string).trim().length > 0
      ? ((originalDoc as Record<string, unknown>).stripeProductId as string).trim()
      : null;
  const isSameStripeProduct =
    stripeProductId != null &&
    originalStripeProductId != null &&
    stripeProductId === originalStripeProductId;

  if (data.skipSync) {
    if (logs) payload.logger?.info?.("Skipping product 'beforeChange' hook");
    return newDoc;
  }

  if (!stripeProductId) {
    if (logs)
      payload.logger?.info?.(
        "No Stripe product assigned to this document, skipping product 'beforeChange' hook"
      );
    return newDoc;
  }

  // Preserve manual admin edits for already-linked products. We only hydrate from Stripe
  // when linking a different product or when the local document omitted pricing data.
  if (isSameStripeProduct && data.priceInformation !== undefined) {
    if (logs) {
      payload.logger?.info?.(
        "Preserving manual price information for existing Stripe product"
      );
    }
    newDoc.stripeProductId = stripeProductId;
    return newDoc;
  }

  if (logs) payload.logger?.info?.("Looking up product from Stripe...");

  try {
    const tenantRef =
      data.tenant ??
      (originalDoc && typeof originalDoc === "object" ? (originalDoc as Record<string, unknown>).tenant : null);
    const tenantId =
      typeof tenantRef === "number"
        ? tenantRef
        : typeof tenantRef === "object" && tenantRef !== null && "id" in tenantRef
          ? Number((tenantRef as { id?: unknown }).id)
          : null;
    const tenantDoc =
      tenantId != null && Number.isFinite(tenantId)
        ? await payload.findByID({
            collection: "tenants" as any,
            id: tenantId,
            depth: 0,
            overrideAccess: true,
          }).catch(() => null)
        : null;
    const tenantDocRecord = tenantDoc as unknown as Record<string, unknown> | null;
    const tenantStripeAccountIdValue =
      tenantDocRecord && typeof tenantDocRecord.stripeConnectAccountId === "string"
        ? tenantDocRecord.stripeConnectAccountId
        : null;
    const tenantStripeAccountId = tenantStripeAccountIdValue?.trim() ?? "";
    const tenantStripeOnboardingStatus =
      tenantDocRecord && typeof tenantDocRecord.stripeConnectOnboardingStatus === "string"
        ? tenantDocRecord.stripeConnectOnboardingStatus
        : null;
    const stripeOpts =
      tenantStripeAccountId &&
      tenantStripeOnboardingStatus === "active"
        ? {
            stripeAccount: tenantStripeAccountId,
          }
        : undefined;

    const stripeProduct = await stripe.products.retrieve(
      stripeProductId,
      { expand: ["default_price"] },
      stripeOpts
    );
    if (logs)
      payload.logger?.info?.(`Found product from Stripe: ${stripeProduct.name}`);
    const price = stripeProduct.default_price as Stripe.Price | undefined;

    newDoc.priceJSON = price;
    newDoc.priceInformation = {
      price: price?.unit_amount != null ? price.unit_amount / 100 : undefined,
      intervalCount: price && "recurring" in price ? price.recurring?.interval_count : undefined,
      interval: price && "recurring" in price ? price.recurring?.interval : undefined,
    };
    newDoc.status = stripeProduct.active ? "active" : "inactive";
    newDoc.stripeProductId = stripeProductId;
  } catch (error: unknown) {
    payload.logger?.error?.(`Error fetching product from Stripe: ${error}`);
    return newDoc;
  }

  return newDoc;
};

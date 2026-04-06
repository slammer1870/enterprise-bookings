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
  const stripeProductId =
    typeof data.stripeProductId === "string" && data.stripeProductId.trim().length > 0
      ? data.stripeProductId.trim()
      : originalDoc &&
          typeof originalDoc === "object" &&
          typeof (originalDoc as Record<string, unknown>).stripeProductId === "string" &&
          ((originalDoc as Record<string, unknown>).stripeProductId as string).trim().length > 0
        ? ((originalDoc as Record<string, unknown>).stripeProductId as string).trim()
        : null;

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
            collection: "tenants",
            id: tenantId,
            depth: 0,
            overrideAccess: true,
          }).catch(() => null)
        : null;
    const stripeOpts =
      tenantDoc &&
      typeof (tenantDoc as { stripeConnectAccountId?: unknown }).stripeConnectAccountId === "string" &&
      typeof (tenantDoc as { stripeConnectOnboardingStatus?: unknown }).stripeConnectOnboardingStatus === "string" &&
      (tenantDoc as { stripeConnectOnboardingStatus?: string }).stripeConnectOnboardingStatus === "active"
        ? {
            stripeAccount: (tenantDoc as { stripeConnectAccountId: string }).stripeConnectAccountId.trim(),
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

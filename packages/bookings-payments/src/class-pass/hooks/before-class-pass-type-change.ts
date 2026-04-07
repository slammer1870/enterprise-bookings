import type { CollectionBeforeChangeHook } from "payload";
import type Stripe from "stripe";
import { stripe } from "@repo/shared-utils";

const logs = process.env.LOGS_STRIPE_PROXY === "1";

/**
 * Syncs class pass type from Stripe when stripeProductId is set.
 * Expects the linked Stripe product to have a one-time default price.
 */
export const beforeClassPassTypeChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  const { payload } = req;
  const newDoc: Record<string, unknown> = data;
  if (req.context?.skipStripeSync) {
    if (logs) payload.logger?.info?.("Skipping class pass type 'beforeChange' hook via request context");
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

  if (data.skipSync) {
    if (logs) payload.logger?.info?.("Skipping class pass type 'beforeChange' hook");
    return newDoc;
  }

  if (!stripeProductId) {
    if (logs)
      payload.logger?.info?.(
        "No Stripe product assigned to this class pass type, skipping 'beforeChange' hook"
      );
    return newDoc;
  }

  if (logs) payload.logger?.info?.("Looking up class pass product from Stripe...");

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

    if (price && "type" in price && price.type !== "one_time") {
      payload.logger?.warn?.(
        `Stripe product ${stripeProduct.id} default price is not one-time; class pass types expect a one-time price.`
      );
    }

    newDoc.priceJSON = price ? JSON.stringify(price) : null;
    newDoc.priceInformation = {
      price: price?.unit_amount != null ? price.unit_amount / 100 : undefined,
    };
    newDoc.status = stripeProduct.active ? "active" : "inactive";
    newDoc.stripeProductId = stripeProductId;
  } catch (error: unknown) {
    payload.logger?.error?.(`Error fetching product from Stripe: ${error}`);
    return newDoc;
  }

  return newDoc;
};

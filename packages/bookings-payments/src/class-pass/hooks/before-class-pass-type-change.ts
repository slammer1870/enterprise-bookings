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
}) => {
  const { payload } = req;
  const newDoc: Record<string, unknown> = data;

  if (data.skipSync) {
    if (logs) payload.logger?.info?.("Skipping class pass type 'beforeChange' hook");
    return newDoc;
  }

  if (!data.stripeProductId) {
    if (logs)
      payload.logger?.info?.(
        "No Stripe product assigned to this class pass type, skipping 'beforeChange' hook"
      );
    return newDoc;
  }

  if (logs) payload.logger?.info?.("Looking up class pass product from Stripe...");

  try {
    const stripeProduct = await stripe.products.retrieve(
      data.stripeProductId as string,
      { expand: ["default_price"] }
    );
    if (logs)
      payload.logger?.info?.(`Found product from Stripe: ${stripeProduct.name}`);
    const price = stripeProduct.default_price as Stripe.Price | undefined;

    if (price && "type" in price && price.type !== "one_time") {
      payload.logger?.warn?.(
        `Stripe product ${stripeProduct.id} default price is not one-time; class pass types expect a one-time price.`
      );
    }

    newDoc.priceJSON = price;
    newDoc.priceInformation = {
      price: price?.unit_amount != null ? price.unit_amount / 100 : undefined,
    };
    newDoc.status = stripeProduct.active ? "active" : "inactive";
  } catch (error: unknown) {
    payload.logger?.error?.(`Error fetching product from Stripe: ${error}`);
    return newDoc;
  }

  return newDoc;
};

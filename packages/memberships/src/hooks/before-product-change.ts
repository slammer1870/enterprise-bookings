import type { CollectionBeforeChangeHook } from "payload";

import { stripe } from "@repo/shared-utils";

const logs = true;

export const beforeProductChange: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  const { payload } = req;
  const newDoc: Record<string, unknown> = {
    ...data,
    skipSync: false, // Set back to 'false' so that all changes continue to sync to Stripe
  };

  if (data.skipSync) {
    if (logs) payload.logger.info(`Skipping product 'beforeChange' hook`);
    return newDoc;
  }

  if (!data.stripeProductID) {
    if (logs)
      payload.logger.info(
        `No Stripe product assigned to this document, skipping product 'beforeChange' hook`
      );
    return newDoc;
  }

  if (logs) payload.logger.info(`Looking up product from Stripe...`);

  try {
    const stripeProduct = await stripe.products.retrieve(data.stripeProductID, {
      expand: ["default_price"],
    });
    if (logs)
      payload.logger.info(`Found product from Stripe: ${stripeProduct.name}`);
    // newDoc.name = stripeProduct.name;
    newDoc.priceJSON = stripeProduct.default_price;
  } catch (error: unknown) {
    payload.logger.error(`Error fetching product from Stripe: ${error}`);
    return newDoc;
  }

  return newDoc;
};

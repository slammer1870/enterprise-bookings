import type { CollectionBeforeChangeHook } from "payload";

import Stripe from "stripe";

import { stripe } from "@repo/shared-utils";

const logs = true;

export const beforeProductChange: CollectionBeforeChangeHook = async ({
  data,
  req,
}) => {
  const { payload } = req;
  const newDoc: Record<string, unknown> = data;

  if (data.skipSync) {
    if (logs) payload.logger.info(`Skipping product 'beforeChange' hook`);
    return newDoc;
  }

  if (!data.stripeProductId) {
    if (logs)
      payload.logger.info(
        `No Stripe product assigned to this document, skipping product 'beforeChange' hook`
      );
    return newDoc;
  }

  if (logs) payload.logger.info(`Looking up product from Stripe...`);

  try {
    const stripeProduct = await stripe.products.retrieve(data.stripeProductId, {
      expand: ["default_price"],
    });
    if (logs)
      payload.logger.info(`Found product from Stripe: ${stripeProduct.name}`);
    // newDoc.name = stripeProduct.name;
    const price = stripeProduct.default_price as Stripe.Price;

    newDoc.priceJSON = price;
    payload.logger.info(
      `Price: ${price.unit_amount && price.unit_amount / 100}`
    );
    payload.logger.info(`Interval: ${price.recurring?.interval}`);
    payload.logger.info(`Interval Count: ${price.recurring?.interval_count}`);
    newDoc.priceInformation = {
      price: price.unit_amount && price.unit_amount / 100,
      intervalCount: price.recurring?.interval_count,
      interval: price.recurring?.interval,
    };
    newDoc.status = stripeProduct.active ? "active" : "inactive";
  } catch (error: unknown) {
    payload.logger.error(`Error fetching product from Stripe: ${error}`);
    return newDoc;
  }

  return newDoc;
};

import type { CollectionBeforeChangeHook } from "payload";

import { stripe } from "@repo/shared-utils";

const logs = false;

export const beforeSubscriptionChange: CollectionBeforeChangeHook = async ({
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

  if (!data.stripeSubscriptionId) {
    if (logs)
      payload.logger.info(
        `No Stripe product assigned to this document, skipping product 'beforeChange' hook`
      );
    return newDoc;
  }

  if (logs) payload.logger.info(`Looking up product from Stripe...`);

  try {
    const stripeSubscription = await stripe.subscriptions.retrieve(
      data.stripeSubscriptionId
    );
    if (logs)
      payload.logger.info(
        `Found subscription from Stripe: ${stripeSubscription.id}`
      );
    payload.logger.info(
      "Subscription start date:",
      stripeSubscription.current_period_start
    );
    newDoc.startDate = new Date(
      stripeSubscription.current_period_start * 1000
    ).toISOString();
    newDoc.endDate = new Date(
      stripeSubscription.current_period_end * 1000
    ).toISOString();
    newDoc.status = stripeSubscription.status;

    if (stripeSubscription.cancel_at) {
      newDoc.cancelAt = new Date(
        stripeSubscription.cancel_at * 1000
      ).toISOString();
    }
  } catch (error: unknown) {
    payload.logger.error(`Error fetching product from Stripe: ${error}`);
    return newDoc;
  }

  return newDoc;
};

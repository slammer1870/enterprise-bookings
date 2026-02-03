import { StripeWebhookHandler } from "@payloadcms/plugin-stripe/types";
import { Plan } from "@repo/shared-types";
import Stripe from "stripe";

export const productUpdated: StripeWebhookHandler<{
  data: {
    object: Stripe.Product;
  };
}> = async (args) => {
  const { event, payload } = args;

  const { id } = event.data.object;

  // Plugin-added collection slugs; app Payload types may not include them when building.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin collections not in app types
  const asCollection = (s: string): any => s;

  try {
    const planQuery = await payload.find({
      collection: asCollection("plans"),
      where: { stripeProductId: { equals: id } },
      limit: 1,
    });

    if (planQuery.totalDocs === 0 || !planQuery.docs[0]) {
      payload.logger.info("Skipping product update: Plan not found");
      return;
    }

    const plan = planQuery.docs[0] as Plan;

    await payload.update({
      collection: asCollection("plans"),
      id: plan.id as number,
      data: {
        // Trigger the beforeChange hook which will sync data from Stripe
        // The hook will populate the necessary fields from Stripe product data
      },
    });
  } catch (error) {
    payload.logger.error(`Error updating product: ${error}`);
  }
};

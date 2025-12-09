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

  try {
    const planQuery = await payload.find({
      collection: "plans",
      where: { stripeProductId: { equals: id } },
      limit: 1,
    });

    if (planQuery.totalDocs === 0 || !planQuery.docs[0]) {
      payload.logger.info("Skipping product update: Plan not found");
      return;
    }

    const plan = planQuery.docs[0] as Plan;

    await payload.update({
      collection: "plans",
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

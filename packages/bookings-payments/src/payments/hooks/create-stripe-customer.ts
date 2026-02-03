import type { CollectionBeforeChangeHook } from "payload";
import { stripe } from "@repo/shared-utils";

export const createStripeCustomer: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation === "create" && !data.stripeCustomerId) {
    try {
      const existingCustomer = await stripe.customers.list({
        email: data.email,
        limit: 1,
      });

      if (existingCustomer.data.length) {
        return {
          ...data,
          stripeCustomerId: existingCustomer.data[0]?.id,
        };
      }

      const customer = await stripe.customers.create({
        name: data.name,
        email: data.email,
      });

      return {
        ...data,
        stripeCustomerId: customer.id,
      };
    } catch (error: unknown) {
      req.payload.logger?.error?.(`Error creating Stripe customer: ${error}`);
    }
  }

  return data;
};

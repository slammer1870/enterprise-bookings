import type { CollectionBeforeChangeHook } from "payload";

import { stripe } from "@repo/shared-utils";

export const createStripeCustomer: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation === "create" && !data.stripeCustomerId) {
    try {
      // lookup an existing customer by email and if found, assign the ID to the user
      // if not found, create a new customer and assign the new ID to the user
      const existingCustomer = await stripe.customers.list({
        email: data.email,
        limit: 1,
      });

      if (existingCustomer.data.length) {
        // existing customer found, assign the ID to the user
        return {
          ...data,
          stripeCustomerId: existingCustomer.data[0]?.id,
        };
      }

      // create a new customer and assign the ID to the user
      const customer = await stripe.customers.create({
        name: data.name,
        email: data.email,
      });

      return {
        ...data,
        stripeCustomerId: customer.id,
      };
    } catch (error: unknown) {
      req.payload.logger.error(`Error creating Stripe customer: ${error}`);
    }
  }

  return data;
};

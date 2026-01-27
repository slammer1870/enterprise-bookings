import type { Payload } from "payload";
import type Stripe from "stripe";
import { stripe } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

export async function findUserByCustomer(
  payload: Payload,
  customerId: string | Stripe.Customer
): Promise<User | null> {
  const customerIdString =
    typeof customerId === "string" ? customerId : customerId.id;

  const userByCustomerId = await payload.find({
    collection: "users" as const,
    where: { stripeCustomerId: { equals: customerIdString } },
    limit: 1,
  });

  if (userByCustomerId.totalDocs > 0) {
    return userByCustomerId.docs[0] as User;
  }

  let customerEmail: string | null = null;
  try {
    if (typeof customerId === "object" && customerId.email) {
      customerEmail = customerId.email;
    } else {
      const customer = await stripe.customers.retrieve(customerIdString);
      if (typeof customer !== "string" && !customer.deleted) {
        customerEmail = customer.email;
      }
    }
  } catch (error) {
    payload.logger?.error?.(`Error fetching customer from Stripe: ${error}. Customer ID: ${customerIdString}`);
    return null;
  }

  if (!customerEmail) return null;

  const userByEmail = await payload.find({
    collection: "users" as const,
    where: { email: { equals: customerEmail } },
    limit: 1,
  });

  if (userByEmail.totalDocs > 0) {
    const user = userByEmail.docs[0] as User;
    if (!user.stripeCustomerId) {
      try {
        // stripeCustomerId is added by the plugin; app User type may not include it when building.
        await payload.update({
          collection: "users" as const,
          id: user.id as number,
          data: { stripeCustomerId: customerIdString } as Record<string, unknown>,
        });
      } catch (error) {
        payload.logger?.error?.(`Error updating user stripeCustomerId: ${error}`);
      }
    }
    return user;
  }
  return null;
}

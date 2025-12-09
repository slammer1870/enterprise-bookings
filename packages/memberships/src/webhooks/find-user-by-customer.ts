import type { Payload } from "payload";
import Stripe from "stripe";
import { stripe } from "@repo/shared-utils";
import { User } from "@repo/shared-types";

/**
 * Finds a user by Stripe customer ID, with fallback to email lookup.
 * If user is found by email but doesn't have stripeCustomerId set, it will be updated.
 *
 * @param payload - Payload instance
 * @param customerId - Stripe customer ID (can be string ID or expanded Customer object)
 * @returns User document or null if not found
 */
export const findUserByCustomer = async (
  payload: Payload,
  customerId: string | Stripe.Customer
): Promise<User | null> => {
  // Handle expanded customer object
  const customerIdString =
    typeof customerId === "string" ? customerId : customerId.id;

  // First, try to find user by stripeCustomerId
  const userByCustomerId = await payload.find({
    collection: "users",
    where: { stripeCustomerId: { equals: customerIdString } },
    limit: 1,
  });

  if (userByCustomerId.totalDocs > 0) {
    return userByCustomerId.docs[0] as User;
  }

  // If not found, fetch customer from Stripe to get email
  let customerEmail: string | null = null;

  try {
    // Check if customer is already expanded
    if (typeof customerId === "object" && customerId.email) {
      customerEmail = customerId.email;
    } else {
      // Fetch customer from Stripe
      const customer = await stripe.customers.retrieve(customerIdString);
      if (typeof customer !== "string" && !customer.deleted) {
        customerEmail = customer.email;
      }
    }
  } catch (error) {
    payload.logger.error(
      `Error fetching customer from Stripe: ${error}. Customer ID: ${customerIdString}`
    );
    return null;
  }

  // If no email found, can't proceed
  if (!customerEmail) {
    payload.logger.info(
      `Customer ${customerIdString} has no email, cannot find user`
    );
    return null;
  }

  // Try to find user by email
  const userByEmail = await payload.find({
    collection: "users",
    where: { email: { equals: customerEmail } },
    limit: 1,
  });

  if (userByEmail.totalDocs > 0) {
    const user = userByEmail.docs[0] as User;

    // Update user's stripeCustomerId if it's not set or doesn't match
    if (!user.stripeCustomerId || user.stripeCustomerId !== customerIdString) {
      try {
        const updatedUser = await payload.update({
          collection: "users",
          id: user.id as number,
          data: {
            stripeCustomerId: customerIdString,
          },
          overrideAccess: true, // Bypass access control for webhook
        });
        payload.logger.info(
          `Updated user ${user.id} with stripeCustomerId: ${customerIdString} (was: ${user.stripeCustomerId || "none"})`
        );
        // Return the updated user
        return updatedUser as User;
      } catch (error) {
        payload.logger.error(
          `Error updating user stripeCustomerId: ${error}`
        );
        // Return the original user even if update failed
        return user;
      }
    }

    return user;
  }

  return null;
};


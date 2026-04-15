import type { Payload } from "payload";
import type Stripe from "stripe";
import { stripe } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";

export async function findUserByCustomer(
  payload: Payload,
  customerId: string | Stripe.Customer,
  options?: { stripeAccountId?: string | null }
): Promise<User | null> {
  const customerIdString =
    typeof customerId === "string" ? customerId : customerId.id;
  const stripeAccountId =
    typeof options?.stripeAccountId === "string" && options.stripeAccountId.trim()
      ? options.stripeAccountId.trim()
      : null;

  // 1) Connect: user already has this account+customer in stripeCustomers (see ensureStripeCustomerIdForAccount)
  if (stripeAccountId) {
    const userByConnectMapping = await payload.find({
      collection: "users" as const,
      where: {
        and: [
          { "stripeCustomers.stripeAccountId": { equals: stripeAccountId } },
          { "stripeCustomers.stripeCustomerId": { equals: customerIdString } },
        ],
      },
      limit: 1,
    });
    if (userByConnectMapping.totalDocs > 0) {
      return userByConnectMapping.docs[0] as User;
    }
  }

  // 2) Fast path: platform customer id match
  if (!stripeAccountId) {
    const userByCustomerId = await payload.find({
      collection: "users" as const,
      where: { stripeCustomerId: { equals: customerIdString } },
      limit: 1,
    });
    if (userByCustomerId.totalDocs > 0) {
      return userByCustomerId.docs[0] as User;
    }
  }

  let customerEmail: string | null = null;
  try {
    if (typeof customerId === "object" && customerId.email) {
      customerEmail = customerId.email;
    } else {
      const customer = await stripe.customers.retrieve(
        customerIdString,
        stripeAccountId ? ({ stripeAccount: stripeAccountId } as any) : undefined
      );
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
    try {
      if (stripeAccountId) {
        // Store per-account mapping to avoid poisoning platform stripeCustomerId
        const existing = (user as any)?.stripeCustomers;
        const arr = Array.isArray(existing) ? existing : [];
        const next = [
          ...arr.filter((x: any) => x?.stripeAccountId !== stripeAccountId),
          { stripeAccountId, stripeCustomerId: customerIdString },
        ];
        await payload.update({
          collection: "users" as const,
          id: user.id as number,
          data: { stripeCustomers: next } as Record<string, unknown>,
        });
      } else if (!(user as any).stripeCustomerId) {
        // Backwards-compatible: platform stripe customer id
        await payload.update({
          collection: "users" as const,
          id: user.id as number,
          data: { stripeCustomerId: customerIdString } as Record<string, unknown>,
        });
      }
    } catch (error) {
      payload.logger?.error?.(`Error updating user Stripe customer mapping: ${error}`);
    }
    return user;
  }
  return null;
}

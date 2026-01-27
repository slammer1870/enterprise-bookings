"use server";

import * as crypto from "crypto";
import type { Payload } from "payload";
import type Stripe from "stripe";
import { generatePasswordSaltHash, stripe } from "@repo/shared-utils";
import type { Plan, User } from "@repo/shared-types";

// Plugin-added collection slugs; app Payload types may not include them when building.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin collections not in app types
const asCollection = (s: string): any => s;

export async function syncStripeSubscriptions(payload: Payload) {
  try {
    const stripeSubscriptions = await stripe.subscriptions
      .list({ limit: 100, expand: ["data.customer"] })
      .autoPagingToArray({ limit: 10000 });

    const payloadSubscriptions = await payload.find({
      collection: asCollection("subscriptions"),
      where: { user: { not_equals: null } },
      limit: 0,
    });

    const subscriptionsToSync = stripeSubscriptions.filter(
      (subscription) =>
        !payloadSubscriptions.docs.some(
          (s) => (s as { stripeSubscriptionId?: string }).stripeSubscriptionId === subscription.id
        )
    );

    const newSubscriptions: unknown[] = [];

    for (const stripeSubscription of subscriptionsToSync as Stripe.Subscription[]) {
      const existingSubscription = await payload.find({
        collection: asCollection("subscriptions"),
        where: { stripeSubscriptionId: { equals: stripeSubscription.id } },
      });

      if (existingSubscription.docs.length > 0) continue;

      const customer = stripeSubscription.customer as Stripe.Customer;
      const userQuery = await payload.find({
        collection: asCollection("users"),
        where: { email: { equals: (customer.email ?? "").toLowerCase() } },
      });

      let user: User;

      if (userQuery.docs.length === 0) {
        payload.logger?.info?.({
          message: `Creating user for subscription ${stripeSubscription.id}`,
        });
        if (customer.email == null || customer.name == null) continue;

        const randomPassword = crypto.randomBytes(32).toString("hex");
        const { hash, salt } = await generatePasswordSaltHash({
          password: randomPassword,
        });

        const usersConfig = payload.collections.users?.config;
        const fields = usersConfig?.fields ?? [];
        const hasEmailVerified = fields.some((f) => "name" in f && f.name === "emailVerified");
        const hasRole = fields.some((f) => "name" in f && f.name === "role");

        const newUser = await payload.create({
          collection: asCollection("users"),
          data: {
            name: customer.name,
            email: customer.email,
            stripeCustomerId: customer.id,
            password: hash,
            salt,
            ...(hasEmailVerified && { emailVerified: true }),
            ...(hasRole && { role: "user" }),
          } as Record<string, unknown>,
          draft: false,
        });
        user = newUser as User;
      } else {
        user = userQuery.docs[0] as User;
      }

      const stripeProductInSubscription =
        stripeSubscription.items.data[0]?.plan?.product;
      const stripeProduct = await stripe.products.retrieve(
        stripeProductInSubscription as string,
        { expand: ["default_price"] }
      );
      const price = stripeProduct.default_price as Stripe.Price | null;
      if (!price) continue;

      const planQuery = await payload.find({
        collection: asCollection("plans"),
        where: { priceJSON: { equals: JSON.stringify(price) } },
      });

      let plan: Plan;
      if (planQuery.docs.length === 0) {
        const newPlan = await payload.create({
          collection: asCollection("plans"),
          data: {
            name: stripeProduct.name,
            status: "active",
            priceJSON: JSON.stringify(price),
            priceInformation: {
              price: price.unit_amount ? price.unit_amount / 100 : null,
              intervalCount: price.recurring?.interval_count ?? null,
              interval: price.recurring?.interval ?? null,
            },
          },
        });
        plan = newPlan as Plan;
      } else {
        plan = planQuery.docs[0] as Plan;
      }

      const subscription = await payload.create({
        collection: asCollection("subscriptions"),
        data: {
          stripeSubscriptionId: stripeSubscription.id,
          user: user.id,
          plan: plan.id,
          status: stripeSubscription.status,
          startDate: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          endDate: stripeSubscription.current_period_end
            ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
            : null,
          cancelAt: stripeSubscription.cancel_at
            ? new Date(stripeSubscription.cancel_at * 1000).toISOString()
            : null,
        },
      });
      newSubscriptions.push(subscription);
    }

    return newSubscriptions;
  } catch (error) {
    console.error(error);
    throw error instanceof Error ? error : new Error("Failed to sync Stripe subscriptions");
  }
}

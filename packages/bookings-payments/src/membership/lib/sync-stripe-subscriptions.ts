"use server";

import * as crypto from "crypto";
import type { Payload } from "payload";
import type Stripe from "stripe";
import { stripe } from "@repo/shared-utils";
import { generatePasswordSaltHash } from "@repo/shared-utils/password";
import type { Plan, User } from "@repo/shared-types";

// Plugin-added collection slugs; app Payload types may not include them when building.
const asCollection = (s: string): any => s;

export async function syncStripeSubscriptions(
  payload: Payload,
  options?: { stripeAccountId?: string | null }
) {
  try {
    const stripeAccountId =
      typeof options?.stripeAccountId === "string" && options.stripeAccountId.trim()
        ? options.stripeAccountId.trim()
        : null;
    const stripeOpts = stripeAccountId ? { stripeAccount: stripeAccountId } : undefined;

    const stripeSubscriptions = await stripe.subscriptions
      .list({ limit: 100, expand: ["data.customer"] }, stripeOpts as any)
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
            ...(stripeAccountId
              ? {
                  stripeCustomers: [
                    { stripeAccountId, stripeCustomerId: customer.id },
                  ],
                }
              : { stripeCustomerId: customer.id }),
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
        // Ensure connect mapping exists when syncing from a connected account.
        if (stripeAccountId) {
          const existing = (user as any)?.stripeCustomers;
          const arr = Array.isArray(existing) ? existing : [];
          const has = arr.some(
            (x: any) =>
              x &&
              typeof x === "object" &&
              x.stripeAccountId === stripeAccountId &&
              x.stripeCustomerId === customer.id
          );
          if (!has) {
            await payload.update({
              collection: asCollection("users"),
              id: user.id as number,
              data: {
                stripeCustomers: [
                  ...arr.filter((x: any) => x?.stripeAccountId !== stripeAccountId),
                  { stripeAccountId, stripeCustomerId: customer.id },
                ],
              } as Record<string, unknown>,
            });
          }
        }
      }

      const stripeProductInSubscription =
        stripeSubscription.items.data[0]?.plan?.product;
      const stripeProduct = await stripe.products.retrieve(
        stripeProductInSubscription as string,
        { expand: ["default_price"] },
        stripeOpts as any
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

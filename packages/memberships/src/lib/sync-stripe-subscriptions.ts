"use server";

import * as crypto from "crypto";

import type { Payload } from "payload";

import Stripe from "stripe";

import { generatePasswordSaltHash, stripe } from "@repo/shared-utils";

import { Plan, User } from "@repo/shared-types";

export const syncStripeSubscriptions = async (payload: Payload) => {
  try {
    const stripeSubscriptions = await stripe.subscriptions
      .list({
        limit: 100,
        expand: ["data.customer"],
      })
      .autoPagingToArray({ limit: 10000 });

    const payloadSubscriptions = await payload.find({
      collection: "subscriptions",
      where: { user: { not_equals: null } },
      limit: 0,
    });

    const subscriptionsToSync = stripeSubscriptions.filter(
      (subscription) =>
        !payloadSubscriptions.docs.some(
          (s) => s.stripeSubscriptionId === subscription.id
        )
    );

    const newSubscriptions = [];

    for (const stripeSubscription of subscriptionsToSync) {
      const existingSubscription = await payload.find({
        collection: "subscriptions",
        where: { stripeSubscriptionId: { equals: stripeSubscription.id } },
      });

      if (existingSubscription.docs.length > 0) {
        console.log(
          `Skipping subscription ${stripeSubscription.id} because it already exists`
        );
        continue;
      }

      const customer = stripeSubscription.customer as Stripe.Customer;

      const userQuery = await payload.find({
        collection: "users",
        where: { email: { equals: customer.email } },
      });

      let user: User;

      if (userQuery.docs.length === 0) {
        payload.logger.info(
          `Creating user for subscription ${stripeSubscription.id}`
        );

        if (customer.email === null || customer.name === null) {
          console.log(
            `Skipping subscription ${stripeSubscription.id} because it has no email or name`
          );
          continue;
        }

        const randomPassword = crypto.randomBytes(32).toString("hex");
        const { hash, salt } = await generatePasswordSaltHash({
          password: randomPassword,
        });

        const newUser = await payload.create({
          collection: "users",
          data: {
            name: customer.name as string,
            email: customer.email as string,
            stripeCustomerId: customer.id,
            password: hash,
            salt,
          },
        });

        user = newUser as User;
      } else {
        user = userQuery.docs[0] as User;
      }

      const stripeProductInSubscription =
        stripeSubscription.items.data[0]?.plan.product;

      const stripeProduct = await stripe.products.retrieve(
        stripeProductInSubscription as string,
        {
          expand: ["default_price"],
        }
      );

      const price = stripeProduct.default_price as Stripe.Price;

      const planQuery = await payload.find({
        collection: "plans",
        where: {
          priceJSON: {
            equals: JSON.stringify(price),
          },
        },
      });

      let plan: Plan;

      if (planQuery.docs.length === 0) {
        const newPlan = await payload.create({
          collection: "plans",
          data: {
            name: stripeProduct.name,
            status: "active",
            priceJSON: JSON.stringify(price),
            priceInformation: {
              price: price.unit_amount && price.unit_amount / 100,
              intervalCount: price.recurring?.interval_count,
              interval: price.recurring?.interval,
            },
          },
        });

        plan = newPlan as Plan;
      } else {
        plan = planQuery.docs[0] as Plan;
      }

      const subscription = await payload.create({
        collection: "subscriptions",
        data: {
          stripeSubscriptionId: stripeSubscription.id,
          user: user.id,
          plan: plan.id,
          status: stripeSubscription.status,
          startDate: new Date(
            stripeSubscription.current_period_start * 1000
          ).toISOString(),
          endDate: stripeSubscription.current_period_end
            ? new Date(
                stripeSubscription.current_period_end * 1000
              ).toISOString()
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
    if (error instanceof Error) {
      throw new Error(error.message);
    }

    throw new Error("Failed to sync Stripe subscriptions");
  }
};

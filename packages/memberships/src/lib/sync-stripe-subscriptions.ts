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
      })
      .autoPagingToArray({ limit: 10000 });

    const payloadSubscriptions = await payload.find({
      collection: "subscriptions",
      where: { stripeSubscriptionId: { not_equals: null } },
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

      const userQuery = await payload.find({
        collection: "users",
        where: { stripeCustomerId: { equals: stripeSubscription.customer } },
      });

      let user: User;

      if (userQuery.docs.length === 0) {
        payload.logger.info(
          `Creating user for subscription ${stripeSubscription.id}`
        );

        const stripeCustomer = (await stripe.customers.retrieve(
          stripeSubscription.customer as string
        )) as Stripe.Customer;

        if (stripeCustomer.email === null || stripeCustomer.name === null) {
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
            name: stripeCustomer.name,
            email: stripeCustomer.email,
            stripeCustomerId: stripeSubscription.customer,
            password: hash,
            salt,
          },
        });

        user = newUser as User;
      } else {
        user = userQuery.docs[0] as User;
      }

      const planQuery = await payload.find({
        collection: "plans",
        where: {
          stripeProductId: {
            equals: stripeSubscription.items.data[0]?.plan.product,
          },
        },
      });

      let plan: Plan;

      if (planQuery.docs.length === 0) {
        const stripeProduct = await stripe.products.retrieve(
          stripeSubscription.items.data[0]?.plan.product as string
        );

        const newPlan = await payload.create({
          collection: "plans",
          data: {
            name: stripeProduct.name,
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
          currentPeriodStart: stripeSubscription.current_period_start,
          currentPeriodEnd: stripeSubscription.current_period_end,
          cancelAt: stripeSubscription.cancel_at
            ? stripeSubscription.cancel_at
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

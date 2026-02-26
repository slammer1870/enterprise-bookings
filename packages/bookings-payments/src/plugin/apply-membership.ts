import { modifyUsersCollectionForPayments } from "../payments/collections/users";
import { modifyUsersCollectionForMembership } from "../membership/collections/users";
import { generatePlansCollection } from "../membership/collections/plans";
import { generateSubscriptionCollection } from "../membership/collections/subscriptions";
import { createPlansProxy } from "../membership/endpoints/plans";
import { createSubscriptionsProxy } from "../membership/endpoints/subscriptions";
import { createCheckoutSession } from "../membership/endpoints/create-checkout-session";
import { createCustomerPortal } from "../membership/endpoints/create-customer-portal";
import { syncStripeSubscriptionsEndpoint } from "../membership/endpoints/sync-stripe-subscriptions";
import { syncStripeSubscriptionsTask } from "../membership/tasks/sync-stripe-subscriptions";
import type { MembershipConfig } from "../types";
import type { PluginContext } from "./context";
import { forEachPaymentMethodSlug } from "./forEachPaymentMethodSlug";
import { injectAllowedPlansIntoCollection } from "./inject-payment-methods";

/**
 * Applies the membership feature: plans, subscriptions, users (stripeCustomerId + userSubscription),
 * membership endpoints, sync-stripe-subscriptions job, and allowedPlans injection
 * into the configured payment-method collections.
 * stripeCustomerId is added to users by default whenever drop-ins, payments, or membership is enabled.
 */
export function applyMembershipFeature(
  ctx: PluginContext,
  membership: MembershipConfig
): void {
  const usersCollection = ctx.collections.find((c) => c.slug === "users");
  if (!usersCollection) {
    throw new Error("Users collection not found");
  }
  ctx.collections = ctx.collections.filter((c) => c.slug !== "users");
  const usersWithStripeCustomerId = modifyUsersCollectionForPayments(usersCollection);
  const usersWithMembership = modifyUsersCollectionForMembership(usersWithStripeCustomerId);
  ctx.collections.push(usersWithMembership);
  ctx.endpoints.push({
    path: "/stripe/plans",
    method: "get",
    handler: createPlansProxy(membership),
  });
  ctx.endpoints.push({
    path: "/stripe/subscriptions",
    method: "get",
    handler: createSubscriptionsProxy(membership),
  });
  ctx.endpoints.push({
    path: "/stripe/create-checkout-session",
    method: "post",
    handler: createCheckoutSession(
      membership.getSubscriptionBookingFeeCents
        ? { getSubscriptionBookingFeeCents: membership.getSubscriptionBookingFeeCents }
        : undefined,
    ),
  });
  ctx.endpoints.push({
    path: "/stripe/create-customer-portal",
    method: "post",
    handler: createCustomerPortal,
  });

  if (membership.syncStripeSubscriptions === true) {
    ctx.endpoints.push({
      path: "/stripe/sync-stripe-subscriptions",
      method: "post",
      handler: syncStripeSubscriptionsEndpoint,
    });
    if (!ctx.config.jobs) {
      ctx.config.jobs = { tasks: [] };
    }
    if (!ctx.config.jobs.tasks) {
      ctx.config.jobs.tasks = [];
    }
    ctx.config.jobs.tasks.push({
      slug: "syncStripeSubscriptions",
      handler: syncStripeSubscriptionsTask,
    });
  }

  const plansCollection = generatePlansCollection(membership);
  ctx.collections.push(generateSubscriptionCollection(membership));
  ctx.collections.push(plansCollection);

  const slugs = membership.paymentMethodSlugs ?? [];
  if (slugs.length > 0) {
    const joinFields = forEachPaymentMethodSlug(
      ctx,
      slugs,
      injectAllowedPlansIntoCollection,
      { on: "paymentMethods.allowedPlans", hasMany: true }
    );
    plansCollection.fields = [
      ...(plansCollection.fields ?? []),
      ...joinFields,
    ];
    ctx.collections = ctx.collections.filter((c) => c.slug !== "plans");
    ctx.collections.push(plansCollection);
  }
}

import type {
  Config,
  Plugin,
  CollectionConfig,
  CollectionSlug,
  GroupField,
} from "payload";
import { bookingTransactionsCollection } from "../collections/booking-transactions";
import { classPassesCollection } from "../collections/class-passes";
import { dropInsCollection } from "../collections/drop-ins";
import { transactionsCollection } from "../collections/transactions";
import { modifyUsersCollectionForPayments } from "../collections/modify-users-payments";
import { customersProxy } from "../endpoints/customers";
import { createPaymentIntent } from "../endpoints/create-payment-intent";
import type { BookingsPaymentsPluginConfig } from "../types";
import { modifyUsersCollectionForMembership } from "../membership/collections/users";
import { generatePlansCollection } from "../membership/collections/plans";
import { generateSubscriptionCollection } from "../membership/collections/subscriptions";
import { plansProxy } from "../membership/endpoints/plans";
import { subscriptionsProxy } from "../membership/endpoints/subscriptions";
import { createCheckoutSession } from "../membership/endpoints/create-checkout-session";
import { createCustomerPortal } from "../membership/endpoints/create-customer-portal";
import { syncStripeSubscriptionsEndpoint } from "../membership/endpoints/sync-stripe-subscriptions";
import { syncStripeSubscriptionsTask } from "../membership/tasks/sync-stripe-subscriptions";

function injectAllowedClassPassesIntoCollection(
  collection: CollectionConfig,
  _slug: string
): void {
  const fields = collection.fields ?? [];
  let group = fields.find(
    (f) => f.type === "group" && "name" in f && f.name === "paymentMethods"
  );
  if (!group || group.type !== "group" || !("fields" in group)) {
    const newGroup = {
      name: "paymentMethods",
      label: "Payment Methods",
      type: "group" as const,
      fields: [
        {
          name: "allowedClassPasses",
          type: "checkbox" as const,
          label: "Allow class passes for this class option",
          defaultValue: false,
          admin: {
            description:
              "When enabled, users with a valid class pass for this tenant can book without paying per session.",
          },
        },
      ],
    };
    collection.fields = [...fields, newGroup];
    return;
  }
  const groupFields = group.fields as Array<{ name?: string; [k: string]: unknown }>;
  if (groupFields.some((f) => f.name === "allowedClassPasses")) return;
  groupFields.push({
    name: "allowedClassPasses",
    type: "checkbox",
    label: "Allow class passes for this class option",
    defaultValue: false,
    admin: {
      description:
        "When enabled, users with a valid class pass for this tenant can book without paying per session.",
    },
  });
}

function injectAllowedPlansIntoCollection(
  collection: CollectionConfig,
  slug: string
): void {
  const fields = collection.fields ?? [];
  const group = fields.find(
    (f) => f.type === "group" && "name" in f && f.name === "paymentMethods"
  ) as GroupField | undefined;
  if (!group || group.type !== "group" || !("fields" in group)) {
    collection.fields = [
      ...fields,
      {
        name: "paymentMethods",
        label: "Payment Methods",
        type: "group" as const,
        fields: [
          {
            name: "allowedPlans",
            type: "relationship" as const,
            relationTo: "plans" as CollectionSlug,
            hasMany: true,
          },
        ],
      },
    ];
    return;
  }
  const groupFields = group.fields as Array<{ name?: string; [k: string]: unknown }>;
  if (groupFields.some((f) => f.name === "allowedPlans")) return;
  groupFields.push({
    name: "allowedPlans",
    type: "relationship",
    relationTo: "plans" as CollectionSlug,
    hasMany: true,
  });
}

function injectAllowedDropInIntoCollection(
  collection: CollectionConfig,
  slug: string
): void {
  const fields = collection.fields ?? [];
  let group = fields.find(
    (f) => f.type === "group" && "name" in f && f.name === "paymentMethods"
  ) as GroupField | undefined;
  if (!group || group.type !== "group" || !("fields" in group)) {
    collection.fields = [
      ...fields,
      {
        name: "paymentMethods",
        label: "Payment Methods",
        type: "group" as const,
        fields: [
          {
            name: "allowedDropIn",
            label: "Allowed Drop In",
            type: "relationship" as const,
            relationTo: "drop-ins" as CollectionSlug,
            hasMany: false,
          },
        ],
      },
    ];
    return;
  }
  const groupFields = group.fields as Array<{ name?: string; [k: string]: unknown }>;
  if (groupFields.some((f) => f.name === "allowedDropIn")) return;
  groupFields.push({
    name: "allowedDropIn",
    label: "Allowed Drop In",
    type: "relationship",
    relationTo: "drop-ins",
    hasMany: false,
  });
}

export const bookingsPaymentsPlugin =
  (pluginOptions: BookingsPaymentsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    const config = { ...incomingConfig };
    const classPass = pluginOptions.classPass;
    const payments = pluginOptions.payments;
    const membership = pluginOptions.membership;

    const anyEnabled = classPass?.enabled || payments?.enabled || membership?.enabled;
    if (!anyEnabled) {
      return config;
    }

    let collections = [...(config.collections || [])];
    const endpoints = [...(config.endpoints || [])];

    // Payments: users modification, endpoints, transactions, optional drop-ins, booking-transactions when payments
    if (payments?.enabled) {
      const usersCollection = collections.find((c) => c.slug === "users");
      if (usersCollection) {
        collections = collections.filter((c) => c.slug !== "users");
        collections.push(modifyUsersCollectionForPayments(usersCollection));
      }
      endpoints.push({ path: "/stripe/customers", method: "get", handler: customersProxy });
      endpoints.push({ path: "/stripe/create-payment-intent", method: "post", handler: createPaymentIntent });
      collections = collections.filter((c) => c.slug !== "transactions");
      collections.push(transactionsCollection(payments.transactionsOverrides));

      if (payments.enableDropIns && payments.paymentMethodSlugs?.length) {
        const dropIns = dropInsCollection({
          acceptedPaymentMethods: payments.acceptedPaymentMethods ?? ["cash", "card"],
          overrides: payments.dropInsOverrides,
        });
        collections = collections.filter((c) => c.slug !== "drop-ins");
        for (const slug of payments.paymentMethodSlugs) {
          const target = collections.find((c) => c.slug === slug);
          if (target) injectAllowedDropInIntoCollection(target, slug);
        }
        const joinFields = payments.paymentMethodSlugs.map((slug) => {
          const coll = collections.find((c) => c.slug === slug);
          return {
            name: `${slug}PaymentMethods`,
            label: `${(coll as { labels?: { singular?: string } })?.labels?.singular ?? slug} Payment Methods`,
            type: "join" as const,
            collection: slug as CollectionSlug,
            on: "paymentMethods.allowedDropIn" as const,
            hasMany: false,
          };
        });
        dropIns.fields = [...(dropIns.fields ?? []), ...joinFields];
        collections.push(dropIns);
      }
    }

    // Booking-transactions when classPass OR payments (single shared collection)
    const needsBookingTransactions = (classPass?.enabled || payments?.enabled) &&
      !collections.some((c) => c.slug === "booking-transactions");
    if (needsBookingTransactions) {
      collections.push(
        bookingTransactionsCollection(
          classPass?.bookingTransactionsOverrides ??
          payments?.bookingTransactionsOverrides
        )
      );
    }

    // ClassPass: class-passes, inject allowedClassPasses
    if (classPass?.enabled) {
      collections.push(
        classPassesCollection({
          classOptionsSlug: classPass.classOptionsSlug ?? "class-options",
          adminGroup: classPass.adminGroup ?? "Bookings",
          overrides: classPass.classPassesOverrides,
        })
      );
      const classOptionsSlug = classPass.classOptionsSlug ?? "class-options";
      const target = collections.find((c) => c.slug === classOptionsSlug);
      if (target) injectAllowedClassPassesIntoCollection(target, classOptionsSlug);
    }

    // Membership: in-tree plans, subscriptions, users (userSubscription), endpoints, allowedPlans injection
    if (membership?.enabled) {
      const usersCollection = collections.find((c) => c.slug === "users");
      if (usersCollection) {
        collections = collections.filter((c) => c.slug !== "users");
        collections.push(modifyUsersCollectionForMembership(usersCollection));
      }
      endpoints.push({ path: "/stripe/plans", method: "get", handler: plansProxy });
      endpoints.push({ path: "/stripe/subscriptions", method: "get", handler: subscriptionsProxy });
      endpoints.push({
        path: "/stripe/create-checkout-session",
        method: "post",
        handler: createCheckoutSession,
      });
      endpoints.push({
        path: "/stripe/create-customer-portal",
        method: "post",
        handler: createCustomerPortal,
      });
      endpoints.push({
        path: "/stripe/sync-stripe-subscriptions",
        method: "post",
        handler: syncStripeSubscriptionsEndpoint,
      });

      if (!config.jobs) {
        config.jobs = { tasks: [] };
      }
      if (!config.jobs.tasks) {
        config.jobs.tasks = [];
      }
      config.jobs.tasks.push({
        slug: "syncStripeSubscriptions",
        handler: syncStripeSubscriptionsTask,
      });

      const plansCollection = generatePlansCollection(membership);
      collections.push(generateSubscriptionCollection(membership));
      collections.push(plansCollection);

      for (const slug of membership.paymentMethodSlugs ?? []) {
        const collection = collections.find((c) => c.slug === slug);
        if (!collection) continue;
        injectAllowedPlansIntoCollection(collection, slug);
        const joinFieldName = `${slug}PaymentMethods`;
        const hasJoin = (plansCollection.fields ?? []).some(
          (f) => "name" in f && f.name === joinFieldName
        );
        if (!hasJoin) {
          plansCollection.fields = [
            ...(plansCollection.fields ?? []),
            {
              name: joinFieldName,
              label: `${(collection as { labels?: { singular?: string } })?.labels?.singular ?? slug} Payment Methods`,
              type: "join" as const,
              collection: slug as CollectionSlug,
              on: "paymentMethods.allowedPlans" as const,
              hasMany: true,
            },
          ];
        }
        collections = collections.filter((c) => c.slug !== "plans");
        collections.push(plansCollection);
      }
    }

    config.collections = collections;
    config.endpoints = endpoints;

    return config;
  };

/**
 * Transactions: record how each booking was paid.
 * Decrement hook only decrements class pass when a transaction exists with paymentMethod 'class_pass'.
 * Subscription bookings create a transaction with paymentMethod 'subscription' and subscriptionId.
 */
import type { CollectionConfig } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import type { CollectionOverrides } from "../types";

const PAYMENT_METHODS = ["stripe", "class_pass", "subscription"] as const;

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
  create: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as unknown as User | null),
};

const defaultFields: NonNullable<CollectionConfig["fields"]> = [
  {
    name: "booking",
    type: "relationship",
    relationTo: "bookings",
    required: true,
    admin: { description: "The booking this transaction applies to." },
    // When createBookingTransactionOnCreate sets skipBookingValidationForId, accept that id so deferred create succeeds
    validate: (value: number | unknown, args: { req?: unknown }) => {
      const ctx = (args?.req as { context?: { skipBookingValidationForId?: number } })
        ?.context;
      if (ctx?.skipBookingValidationForId != null && ctx.skipBookingValidationForId === value)
        return true;
      return undefined as unknown as true;
    },
  },
  {
    name: "paymentMethod",
    type: "select",
    options: [...PAYMENT_METHODS],
    required: true,
    admin: { description: "How the booking was paid." },
  },
  {
    name: "classPassId",
    type: "number",
    required: false,
    admin: {
      description: "The class pass id used when paymentMethod is class_pass.",
      condition: (_: unknown, siblingData: { paymentMethod?: string }) =>
        siblingData?.paymentMethod === "class_pass",
    },
  },
  {
    name: "stripePaymentIntentId",
    type: "text",
    required: false,
    admin: {
      description: "Stripe payment intent id when paymentMethod is stripe.",
      condition: (_: unknown, siblingData: { paymentMethod?: string }) =>
        siblingData?.paymentMethod === "stripe",
    },
  },
  {
    name: "subscriptionId",
    type: "number",
    required: false,
    admin: {
      description: "Subscription id when paymentMethod is subscription (booking created by subscription).",
      condition: (_: unknown, siblingData: { paymentMethod?: string }) =>
        siblingData?.paymentMethod === "subscription",
    },
  },
];

export function transactionsCollection(
  opts?: CollectionOverrides
): CollectionConfig {
  const access = opts?.access
    ? { ...defaultAccess, ...opts.access }
    : defaultAccess;
  const fields = opts?.fields
    ? opts.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const base: CollectionConfig = {
    slug: "transactions",
    dbName: "booking_transactions",
    admin: {
      useAsTitle: "id",
      group: "Billing",
      defaultColumns: ["booking", "paymentMethod", "classPassId", "subscriptionId", "createdAt"],
      description:
        "Records how each booking was paid (Stripe, class pass, or subscription). Used to decrement class pass when paymentMethod is class_pass.",
    },
    access,
    fields,
  };
  if (opts?.hooks) {
    base.hooks = opts.hooks({
      defaultHooks: base.hooks ?? {},
    });
  }
  return base;
}

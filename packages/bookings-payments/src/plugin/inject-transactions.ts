import type { CollectionConfig, Field } from "payload";

const TRANSACTIONS_FIELD_NAME = "transactions";

/**
 * Injects a "transactions" relationship into the bookings collection when
 * the transactions collection is added by the plugin. Allows viewing payment
 * transactions (Stripe, class pass, subscription) from a booking in the admin.
 */
export function injectTransactionsIntoBookings(
  collection: CollectionConfig
): void {
  const fields = (collection.fields ?? []) as Field[];
  if (fields.some((f) => "name" in f && f.name === TRANSACTIONS_FIELD_NAME)) {
    return;
  }
  collection.fields = [
    ...fields,
    {
      name: TRANSACTIONS_FIELD_NAME,
      type: "relationship" as const,
      relationTo: "transactions" as import("payload").CollectionSlug,
      hasMany: true,
      label: "Transactions",
      admin: {
        description:
          "Payment transactions for this booking (Stripe, class pass, or subscription). Injected by @repo/bookings-payments when enabled.",
        readOnly: true,
      },
    },
  ];
}

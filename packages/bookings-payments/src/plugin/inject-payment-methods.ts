import type { CollectionConfig, CollectionSlug, Field, GroupField } from "payload";

/** Field config passed in; name is set by injectPaymentMethodField. */
type PaymentMethodFieldConfig = Record<string, unknown>;

const PAYMENT_METHODS_GROUP_NAME = "paymentMethods";
const PAYMENT_METHODS_GROUP_LABEL = "Payment Methods";

/**
 * Finds or creates the paymentMethods group on the collection, then ensures
 * the given field is present (by name). Mutates collection.fields and the group's fields.
 */
function injectPaymentMethodField(
  collection: CollectionConfig,
  fieldName: string,
  fieldConfig: PaymentMethodFieldConfig
): void {
  const fields = collection.fields ?? [];
  let group = fields.find(
    (f) => f.type === "group" && "name" in f && f.name === PAYMENT_METHODS_GROUP_NAME
  ) as GroupField | undefined;
  if (!group || group.type !== "group" || !("fields" in group)) {
    const newGroup: GroupField = {
      name: PAYMENT_METHODS_GROUP_NAME,
      label: PAYMENT_METHODS_GROUP_LABEL,
      type: "group",
      fields: [{ ...fieldConfig, name: fieldName } as Field],
    };
    collection.fields = [...fields, newGroup];
    return;
  }
  const groupFields = group.fields as Field[];
  if (groupFields.some((f) => "name" in f && f.name === fieldName)) return;
  groupFields.push({ ...fieldConfig, name: fieldName } as Field);
}

/**
 * Injects or appends "allowedClassPasses" into the paymentMethods group of the given collection.
 * Used when the class-pass feature is enabled. Relationship to class-pass-types – select which
 * pass types (e.g. Fitness Only, Sauna Only) are accepted for this class option.
 */
export function injectAllowedClassPassesIntoCollection(
  collection: CollectionConfig,
  _slug: string
): void {
  injectPaymentMethodField(collection, "allowedClassPasses", {
    type: "relationship",
    label: "Allowed Class Pass Types",
    relationTo: "class-pass-types" as CollectionSlug,
    hasMany: true,
    admin: {
      description:
        "Select which class pass types can be used to book this class option (e.g. Fitness Only, Sauna Only).",
    },
  });
}

/**
 * Injects or appends "allowedPlans" into the paymentMethods group of the given collection.
 * Used when the membership feature is enabled.
 */
export function injectAllowedPlansIntoCollection(
  collection: CollectionConfig,
  _slug: string
): void {
  injectPaymentMethodField(collection, "allowedPlans", {
    type: "relationship",
    label: "Allowed Membership Plans",
    relationTo: "memberships" as CollectionSlug,
    hasMany: true,
    admin: {
      description:
        "Membership plans that grant access to this class option. Users with an active subscription to a selected plan can book without paying per session.",
    },
  });
}

/**
 * Injects or appends "allowedDropIn" into the paymentMethods group of the given collection.
 * Used when the drop-ins feature is enabled.
 */
export function injectAllowedDropInIntoCollection(
  collection: CollectionConfig,
  _slug: string
): void {
  injectPaymentMethodField(collection, "allowedDropIn", {
    type: "relationship",
    label: "Allowed Drop In",
    relationTo: "drop-ins" as CollectionSlug,
    hasMany: false,
    admin: {
      description:
        "One-off payment option for this class (e.g. pay at door, single-session fee). Select a drop-in to allow customers to pay per booking without a class pass or membership.",
    },
  });
}

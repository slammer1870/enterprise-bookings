import type { CollectionConfig } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import type { CollectionOverrides } from "../types";

type DropInsOptions = {
  acceptedPaymentMethods?: ("cash" | "card")[];
  overrides?: CollectionOverrides;
};

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: () => true,
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

export function dropInsCollection(
  pluginOptions: DropInsOptions
): CollectionConfig {
  const acceptedPaymentMethods = pluginOptions.acceptedPaymentMethods ?? [
    "cash",
    "card",
  ];
  const overrides = pluginOptions.overrides;

  const defaultFields: NonNullable<CollectionConfig["fields"]> = [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", required: false },
      { name: "isActive", label: "Active", type: "checkbox", defaultValue: true, required: true },
      { name: "price", label: "Price", type: "number", required: true, min: 0 },
      { name: "adjustable", label: "Adjustable", type: "checkbox", defaultValue: false, required: true },
      {
        name: "discountTiers",
        label: "Discount Tiers",
        type: "array",
        fields: [
          { name: "minQuantity", label: "Min Quantity", type: "number", min: 1, defaultValue: 1, required: true },
          { name: "discountPercent", label: "Discount Percent", type: "number", min: 0, max: 100, required: true },
          {
            name: "type",
            label: "Type",
            type: "select",
            options: [
              { label: "Normal Discount", value: "normal" },
              { label: "Trial Discount (Can only be used on first booking)", value: "trial" },
              { label: "Bulk Discount", value: "bulk" },
            ],
            defaultValue: "normal",
            required: true,
          },
        ],
        validate: (value) => {
          const tiers = value as { minQuantity: number }[] | undefined;
          if (!tiers) return true;
          const quantities = tiers.map((t) => t.minQuantity);
          if (quantities.length !== new Set(quantities).size) return "Min quantity must be unique across all discount tiers";
          const sorted = [...quantities].sort((a, b) => a - b);
          if (JSON.stringify(quantities) !== JSON.stringify(sorted)) return "Min quantities must be in ascending order";
          return true;
        },
      },
    {
      name: "paymentMethods",
      label: "Payment Methods",
      type: "select",
      options: acceptedPaymentMethods,
      defaultValue: acceptedPaymentMethods[0],
      hasMany: true,
      required: true,
    },
  ];

  const access = overrides?.access
    ? { ...defaultAccess, ...overrides.access }
    : defaultAccess;
  const fields = overrides?.fields
    ? overrides.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const base: CollectionConfig = {
    slug: "drop-ins",
    labels: { singular: "Drop In", plural: "Drop Ins" },
    admin: { useAsTitle: "name", group: "Products" },
    access,
    fields,
  };
  if (overrides?.hooks) {
    base.hooks = overrides.hooks({
      defaultHooks: base.hooks ?? {},
    });
  }
  return base;
}

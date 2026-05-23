import type { CollectionConfig } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import type { CollectionOverrides } from "../../types";

type DropInsOptions = {
  overrides?: CollectionOverrides;
};

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: () => true,
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

export function dropInsCollection(
  pluginOptions: DropInsOptions = {}
): CollectionConfig {
  const overrides = pluginOptions.overrides;

  const defaultFields: NonNullable<CollectionConfig["fields"]> = [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", required: false },
      { name: "isActive", label: "Active", type: "checkbox", defaultValue: true, required: true },
      { name: "price", label: "Price", type: "number", required: true, min: 0 },
      // Backwards-compat: legacy flag used by older clients + some tests.
      // When true, map to "no per-user cap" by setting maxBookingsPerTimeslot=null.
      {
        name: "adjustable",
        label: "Adjustable (legacy)",
        type: "checkbox",
        defaultValue: false,
        required: false,
        admin: { hidden: true },
      },
      {
        name: "maxBookingsPerTimeslot",
        label: "Max bookings per timeslot (per user)",
        type: "number",
        required: false,
        validate: (value: unknown) => {
          if (value == null) return true;
          return typeof value === "number" && value >= 1
            ? true
            : "maxBookingsPerTimeslot must be >= 1 or blank";
        },
        admin: {
          description:
            "Leave blank for no per-user limit (still bounded by the event type capacity). When set, users can book up to this many spots per timeslot for this drop-in.",
        },
      },
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
    hooks: {
      beforeValidate: [
        async ({ data }) => {
          if (!data || typeof data !== "object") return data

          const d = data as {
            adjustable?: boolean
            maxBookingsPerTimeslot?: number | null
          }

          // Legacy mapping: only apply the hidden boolean flag when the numeric field
          // isn't present in the update payload. Otherwise, the new numeric semantics
          // should win (avoids resetting numeric value back to null/1 on save).
          if (
            typeof d.adjustable === "boolean" &&
            typeof d.maxBookingsPerTimeslot === "undefined"
          ) {
            d.maxBookingsPerTimeslot = d.adjustable ? null : 1;
          } else if (typeof d.maxBookingsPerTimeslot === "number") {
            // Explicit numeric cap supersedes legacy "adjustable" unlimited semantics.
            d.adjustable = false;
          } else if (d.maxBookingsPerTimeslot === null) {
            d.adjustable = true;
          }

          return d
        },
      ],
    },
  };
  if (overrides?.hooks) {
    base.hooks = overrides.hooks({
      defaultHooks: base.hooks ?? {},
    });
  }
  return base;
}

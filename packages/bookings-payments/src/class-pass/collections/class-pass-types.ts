import type { CollectionBeforeValidateHook, CollectionConfig, Field } from "payload";
import { checkRole } from "@repo/shared-utils";
import type { User } from "@repo/shared-types";
import {
  classPassTypesReadAccess,
  classPassTypesCreateAccess,
  classPassTypesUpdateAccess,
  classPassTypesDeleteAccess,
} from "../access/class-pass-types";
import { beforeClassPassTypeChange } from "../hooks/before-class-pass-type-change";
import type { CollectionOverrides } from "../../types";
import {
  allowedEventTypeIdsIncludingOverrides,
  classPassSharedPoolIsDisplayOnly,
  displayQuantityForClassPassType,
  relationId,
  validateEventTypeOverrideRows,
} from "@repo/shared-services";
import {
  eventTypeOverridesField,
  validateOptionalMaxBookingsPerTimeslot,
} from "../../fields/event-type-overrides";

const adminOnlyFieldAccess = {
  read: ({ req: { user } }: { req: { user: unknown } }) => checkRole(["admin"], user as User | null),
  create: ({ req: { user } }: { req: { user: unknown } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }: { req: { user: unknown } }) => checkRole(["admin"], user as User | null),
};

export type ClassPassTypesOpts = {
  eventTypesSlug?: string;
  adminGroup?: string;
  overrides?: CollectionOverrides;
};

function allowedEventTypesField(eventTypesSlug: string): Field {
  return {
    name: "allowedEventTypes",
    label: "Allowed event types",
    type: "relationship",
    relationTo: eventTypesSlug as import("payload").CollectionSlug,
    hasMany: true,
    admin: {
      description:
        "Event types this pass can pay for. A pass can be used at any site whose timeslot uses one of these event types. Saving an additional allowance adds that event type here. Types with their own allowance do not draw from Quantity of passes.",
    },
  };
}

const defaultAccess: NonNullable<CollectionConfig["access"]> = {
  read: classPassTypesReadAccess,
  create: classPassTypesCreateAccess,
  update: classPassTypesUpdateAccess,
  delete: classPassTypesDeleteAccess,
};

function classPassTypeFields(eventTypesSlug: string): Field[] {
  return [
  {
    name: "name",
    label: "Name",
    type: "text",
    required: true,
    admin: { description: "e.g. Fitness Only, Sauna Only, All Access" },
  },
  {
    name: "description",
    label: "Description",
    type: "textarea",
    required: false,
    admin: { description: "Optional description of what this pass type covers" },
  },
  allowedEventTypesField(eventTypesSlug),
  {
    name: "quantity",
    label: "Quantity of passes",
    type: "number",
    required: true,
    min: 1,
    admin: {
      description: "Number of passes/credits in this type (e.g. 10 for a 10-pack). Purchased passes get this many credits.",
    },
  },
  {
    name: "daysUntilExpiration",
    label: "Days until expiration",
    type: "number",
    required: true,
    min: 1,
    defaultValue: 365,
    admin: {
      description:
        "When a pass is purchased, it expires this many calendar days after the purchase date.",
    },
  },
  {
    name: "maxBookingsPerTimeslot",
    label: "Max bookings per timeslot (per user)",
    type: "number",
    // Null => no per-user limit (still bounded by event type capacity).
    required: false,
    // Allow `null` explicitly; server/client treat `null` as "unlimited".
    // Avoid `min: 1` because Payload can coerce/validate `null` unexpectedly.
    validate: validateOptionalMaxBookingsPerTimeslot,
    admin: {
      description:
        "Leave blank for no per-user limit. When set, users can book up to this many spots per timeslot using this pass type.",
    },
  },
  // Legacy compatibility: older callers + e2e fixtures use this boolean flag.
  // We keep it hidden and map it onto `maxBookingsPerTimeslot` in `beforeValidate`.
  {
    name: "allowMultipleBookingsPerTimeslot",
    label: "Allow multiple bookings per timeslot (legacy)",
    type: "checkbox",
    required: false,
    admin: { hidden: true },
  },
  eventTypeOverridesField({
    eventTypesSlug,
    countName: "quantity",
    countLabel: "Quantity",
    description:
      "In addition to Quantity of passes, not subtracted from it. A row gives that event type its own credits on top of the shared quantity. Quantity 10 plus a Reformer row of 4 is 14 bookings: 4 for Reformer, and 10 shared by the other allowed types. Using the Reformer credits does not reduce the 10. Saving adds the event type to Allowed event types. Leave max bookings per timeslot blank to keep the pass type cap. A number replaces that cap for this event type only.",
    capDescription:
      "Leave blank to use the pass type's max bookings per timeslot. Set a number to cap this event type only.",
  }),
  {
    name: "stripeProductId",
    type: "text",
    label: "Stripe product",
    required: false,
    access: adminOnlyFieldAccess,
    admin: {
      description: "Link to a Stripe product with a one-time default price for purchase/checkout.",
      components: {
        Field: {
          path: "@repo/ui/components/ui/custom-select#CustomSelect",
          clientProps: { apiUrl: "/api/stripe/class-pass-products", dataLabel: "products" },
        },
      },
      position: "sidebar",
    },
  },
  {
    name: "priceInformation",
    label: "Price Information",
    type: "group",
    access: adminOnlyFieldAccess,
    admin: { description: "Price information for the pass type. Synced from Stripe when a product is linked." },
    fields: [
      {
        name: "price",
        type: "number",
        label: "Price (€)",
        admin: { description: "One-time price in euros (from Stripe default price)" },
      },
    ],
  },
  {
    name: "priceJSON",
    type: "textarea",
    access: adminOnlyFieldAccess,
    admin: { hidden: true, readOnly: true, rows: 10 },
    label: "Price JSON",
  },
  {
    name: "status",
    type: "select",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
    defaultValue: "active",
    admin: { description: "Whether this pass type is available for purchase" },
    required: true,
  },
  {
    name: "skipSync",
    type: "checkbox",
    defaultValue: false,
    access: adminOnlyFieldAccess,
    admin: { description: "Skip syncing price/status from Stripe on save" },
    required: false,
  },
  ];
}

export function classPassTypesCollection(opts: ClassPassTypesOpts = {}): CollectionConfig {
  const eventTypesSlug = opts.eventTypesSlug ?? "event-types";
  const adminGroup = opts.adminGroup ?? "Products";
  const overrides = opts.overrides;
  const access = overrides?.access
    ? { ...defaultAccess, ...overrides.access }
    : defaultAccess;
  const defaultFields = classPassTypeFields(eventTypesSlug);
  const fields = overrides?.fields
    ? overrides.fields({ defaultFields: [...defaultFields] })
    : defaultFields;
  const defaultHooks: NonNullable<CollectionConfig["hooks"]> = {
    beforeValidate: [
      (async ({ data, originalDoc }) => {
        if (!data || typeof data !== "object") return data

        const d = data as {
          allowMultipleBookingsPerTimeslot?: boolean
          maxBookingsPerTimeslot?: number | null
        }

        // Legacy mapping: only apply the hidden boolean flag when the numeric field
        // isn't present in the update payload. Otherwise, the new numeric semantics
        // should win (avoids resetting numeric value back to null/1 on save).
        if (
          typeof d.allowMultipleBookingsPerTimeslot === "boolean" &&
          typeof d.maxBookingsPerTimeslot === "undefined"
        ) {
          d.maxBookingsPerTimeslot = d.allowMultipleBookingsPerTimeslot ? null : 1
        }

        const doc = d as typeof d & {
          allowedEventTypes?: unknown
          quantity?: number
          eventTypeOverrides?: Array<{ eventType?: unknown; quantity?: number | null }>
        }
        const rows = Array.isArray(doc.eventTypeOverrides) ? doc.eventTypeOverrides : []
        const allowedEventTypesForSave = allowedEventTypeIdsIncludingOverrides(
          doc.allowedEventTypes,
          rows,
          (originalDoc as { allowedEventTypes?: unknown } | undefined)?.allowedEventTypes,
        )
        if (allowedEventTypesForSave.idsToStore) {
          doc.allowedEventTypes = allowedEventTypesForSave.idsToStore
        }
        const validation = validateEventTypeOverrideRows({
          allowedEventTypeIds: allowedEventTypesForSave.ids,
          rows: rows.map((row) => ({
            eventTypeId: relationId(row?.eventType),
            count: typeof row?.quantity === "number" ? row.quantity : null,
          })),
        })
        if (validation !== true) throw new Error(validation)
        const passForQuantity = { ...doc, allowedEventTypes: allowedEventTypesForSave.ids }
        if (classPassSharedPoolIsDisplayOnly(passForQuantity)) {
          doc.quantity = displayQuantityForClassPassType(passForQuantity, doc.quantity ?? 1)
        }

        return d
      }) satisfies CollectionBeforeValidateHook,
    ],
    beforeChange: [beforeClassPassTypeChange],
  };
  const hooks = overrides?.hooks
    ? overrides.hooks({ defaultHooks })
    : defaultHooks;

  return {
    slug: "class-pass-types",
    labels: { singular: "Class Pass Type", plural: "Class Pass Types" },
    admin: {
      useAsTitle: "name",
      defaultColumns: ["name", "quantity", "daysUntilExpiration", "priceInformation.price", "status"],
      group: adminGroup,
      description:
        "Defines pass types (e.g. Fitness Only, Sauna Only). Class options can restrict which types are accepted.",
    },
    access,
    fields,
    hooks,
  };
}

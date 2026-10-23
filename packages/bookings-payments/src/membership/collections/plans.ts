import type {
  CollectionAdminOptions,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Field,
  Labels,
} from "payload";
import { checkRole } from "@repo/shared-utils";
import type { AccessControls, HooksConfig, User } from "@repo/shared-types";
import { beforeProductChange } from "../hooks/before-product-change";
import type { MembershipBranchConfig } from "../types";
import { relationId, relationIds, validateEventTypeOverrideRows } from "@repo/shared-services";
import {
  eventTypeOverridesField,
  validateOptionalMaxBookingsPerTimeslot,
} from "../../fields/event-type-overrides";

const defaultLabels: Labels = {
  singular: "Membership",
  plural: "Memberships",
};

const defaultAdmin: CollectionAdminOptions = {
  useAsTitle: "name",
  group: "Products",
};

const defaultAccess: AccessControls = {
  read: () => true,
  create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
  delete: ({ req: { user } }) => checkRole(["admin"], user as User | null),
};

function planFields(eventTypesSlug: string): Field[] {
  return [
  { name: "name", label: "Name", type: "text", required: true },
  {
    name: "features",
    type: "array",
    label: "Features",
    admin: { description: "Features that are included in this plan" },
    fields: [{ name: "feature", label: "Feature", type: "text" }],
  },
  {
    name: "allowedEventTypes",
    label: "Allowed event types",
    type: "relationship",
    relationTo: eventTypesSlug as import("payload").CollectionSlug,
    hasMany: true,
    admin: {
      description:
        "Event types this membership can pay for. A membership can be used at any site whose timeslot uses one of these event types.",
    },
  },
  {
    name: "sessionsInformation",
    label: "Sessions Information",
    type: "group",
    required: false,
    admin: {
      description:
        "Sessions included in this plan (e.g. 10 per month). Important: If a user has e.g. 10 bookings per month, they could book all 10 slots in a single timeslot when allow multiple bookings per timeslot is enabled.",
    },
    fields: [
      {
        type: "row",
        fields: [
          { name: "sessions", label: "Sessions", type: "number", required: false },
          { name: "intervalCount", label: "Per", type: "number", required: false },
          {
            name: "interval",
            label: "Interval",
            type: "select",
            options: [
              { label: "Days", value: "day" },
              { label: "Weeks", value: "week" },
              { label: "Months", value: "month" },
              { label: "Quarters", value: "quarter" },
              { label: "Years", value: "year" },
            ],
            required: false,
          },
        ],
      },
      {
        name: "maxBookingsPerTimeslot",
        label: "Max bookings per timeslot (per user)",
        type: "number",
        required: false,
        // Null => no per-user cap (still bounded by event type capacity).
        // Legacy mapping uses `allowMultipleBookingsPerTimeslot` to set this to `null`.
        validate: validateOptionalMaxBookingsPerTimeslot,
        admin: {
          description:
            "Leave blank for no per-user cap on bookings for the same timeslot (still bounded by event type capacity). When set, subscribers can book up to this many spots per timeslot for the selected plan.",
        },
      },
      // Legacy compatibility: older callers/tests set this boolean and expect it to map to numeric semantics.
      // We keep it hidden and translate to `maxBookingsPerTimeslot` in `beforeValidate`.
      {
        name: "allowMultipleBookingsPerTimeslot",
        label: "Allow multiple bookings per timeslot (legacy)",
        type: "checkbox",
        required: false,
        admin: { hidden: true },
      },
      eventTypeOverridesField({
        eventTypesSlug,
        countName: "sessions",
        countLabel: "Sessions",
        description:
          "Optional. A row adds a separate session allowance for that event type, on top of Sessions. Set Per and Interval to count that event type in its own window, for example 2 sauna sessions a week beside 8 sessions a month. Leave both blank to use the plan's period. Sauna bookings leave the shared sessions unchanged. Leave max bookings per timeslot blank to keep the plan cap. A number replaces that cap for this event type only.",
        capDescription:
          "Leave blank to use the plan's max bookings per timeslot. Set a number to cap this event type only.",
      }),
    ],
  },
  {
    name: "stripeProductId",
    type: "text",
    label: "Stripe Plan",
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    admin: {
      components: {
        Field: {
          path: "@repo/ui/components/ui/custom-select#CustomSelect",
          clientProps: { apiUrl: `/api/stripe/plans`, dataLabel: "products" },
        },
      },
      position: "sidebar",
    },
  },
  {
    name: "priceInformation",
    label: "Price Information",
    admin: { description: "Price information for the plan" },
    type: "group",
    fields: [
      {
        type: "row",
        fields: [
          {
            name: "price",
            type: "number",
            label: "Price (€)",
            admin: { description: "Price of the plan" },
          },
          {
            name: "intervalCount",
            type: "number",
            label: "Per",
            admin: { description: "Number of intervals per period" },
          },
          {
            name: "interval",
            type: "select",
            label: "Interval",
            options: [
              { label: "Day", value: "day" },
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
              { label: "Year", value: "year" },
            ],
            defaultValue: "month",
            admin: { description: "How often the price is charged" },
          },
        ],
      },
    ],
  },
  {
    name: "priceJSON",
    type: "textarea",
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    admin: { hidden: true, readOnly: true, rows: 10 },
    label: "Price JSON",
  },
  {
    name: "footerText",
    type: "text",
    label: "Membership card footer",
    admin: {
      description:
        'Optional message shown at the bottom of the membership card, e.g. "For any questions on membership please email members@example.com".',
      placeholder: "For any questions on membership please email members@example.com",
    },
  },
  {
    name: "status",
    type: "select",
    options: ["active", "inactive"],
    defaultValue: "active",
    admin: { description: "Status of the plan" },
    required: true,
  },
  {
    name: "skipSync",
    type: "checkbox",
    defaultValue: false,
    access: {
      read: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      create: ({ req: { user } }) => checkRole(["admin"], user as User | null),
      update: ({ req: { user } }) => checkRole(["admin"], user as User | null),
    },
    admin: { description: "Skip syncing to Stripe" },
    required: false,
  },
  ];
}

const beforePlanValidate: CollectionBeforeValidateHook = async ({ data }) => {
  if (!data || typeof data !== "object") return data;

  const d = data as {
    sessionsInformation?: {
      allowMultipleBookingsPerTimeslot?: boolean
      maxBookingsPerTimeslot?: number | null
    }
  };

  const si = d.sessionsInformation;
  if (!si || typeof si !== "object") return data;

  // Legacy mapping: only apply when numeric maxBookingsPerTimeslot isn't
  // included in the update payload.
  if (
    typeof si.allowMultipleBookingsPerTimeslot === "boolean" &&
    typeof si.maxBookingsPerTimeslot === "undefined"
  ) {
    si.maxBookingsPerTimeslot = si.allowMultipleBookingsPerTimeslot ? null : 1;
  }

  const doc = data as {
    allowedEventTypes?: unknown;
    sessionsInformation?: {
      eventTypeOverrides?: Array<{
        eventType?: unknown;
        sessions?: number | null;
        interval?: string | null;
        intervalCount?: number | null;
      }>;
    };
  };
  const rows = Array.isArray(doc.sessionsInformation?.eventTypeOverrides)
    ? doc.sessionsInformation.eventTypeOverrides
    : [];
  const sessionIntervals = ["day", "week", "month", "quarter", "year"];
  for (const row of rows) {
    const interval = typeof row?.interval === "string" ? row.interval : "";
    const hasInterval = interval.length > 0;
    const hasCount = typeof row?.intervalCount === "number";
    if (hasInterval && !sessionIntervals.includes(interval)) {
      throw new Error("Interval must be days, weeks, months, quarters, or years.");
    }
    if (hasInterval && !hasCount) {
      row.intervalCount = 1;
    } else if (!hasInterval && hasCount) {
      throw new Error("Set Interval when Per is set, or leave both blank.");
    } else if (hasCount && (row.intervalCount as number) < 1) {
      throw new Error("Per must be at least 1.");
    }
  }
  const validation = validateEventTypeOverrideRows({
    allowedEventTypeIds: relationIds(doc.allowedEventTypes),
    rows: rows.map((row) => ({
      eventTypeId: relationId(row?.eventType),
      count: typeof row?.sessions === "number" ? row.sessions : null,
    })),
  });
  if (validation !== true) throw new Error(validation);

  return data;
};

const defaultHooks: HooksConfig = {
  beforeValidate: [beforePlanValidate],
  beforeChange: [beforeProductChange],
};

export function generatePlansCollection(
  config: MembershipBranchConfig
): CollectionConfig {
  const overrides = config?.plansOverrides;
  return {
    ...(overrides ?? {}),
    slug: "plans",
    defaultSort: "priceInformation.price",
    labels: { ...(overrides?.labels ?? defaultLabels) },
    access: {
      ...(defaultAccess as NonNullable<CollectionConfig["access"]>),
      ...(overrides?.access ?? {}),
    },
    admin: {
      ...defaultAdmin,
      ...(overrides?.admin ?? {}),
    },
    hooks: {
      ...(overrides?.hooks &&
      typeof overrides.hooks === "function"
        ? overrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields: (() => {
      const eventTypesSlug =
        config.eventTypesSlug ?? config.paymentMethodSlugs?.[0] ?? "event-types";
      const defaultFields = planFields(eventTypesSlug);
      return overrides?.fields && typeof overrides.fields === "function"
        ? overrides.fields({ defaultFields })
        : defaultFields;
    })(),
  };
}

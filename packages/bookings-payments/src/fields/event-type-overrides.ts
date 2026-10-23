import type { Field } from "payload";
import { relationIds } from "@repo/shared-services";

export function validateOptionalMaxBookingsPerTimeslot(value: unknown): true | string {
  if (value == null) return true;
  return typeof value === "number" && value >= 1
    ? true
    : "maxBookingsPerTimeslot must be >= 1 or blank";
}

function maxBookingsPerTimeslotOverrideField(description: string): Field {
  return {
    name: "maxBookingsPerTimeslot",
    label: "Max bookings per timeslot (per user)",
    type: "number",
    required: false,
    validate: validateOptionalMaxBookingsPerTimeslot,
    admin: { description },
  };
}

export function eventTypeOverridesField(opts: {
  eventTypesSlug: string;
  countName: "quantity" | "sessions";
  countLabel: string;
  description: string;
  capDescription: string;
}): Field {
  return {
    type: "collapsible",
    label: "Advanced",
    admin: { initCollapsed: true },
    fields: [
      {
        name: "eventTypeOverrides",
        label: "Per event type limits",
        type: "array",
        admin: { description: opts.description },
        fields: [
          {
            name: "eventType",
            label: "Event type",
            type: "relationship",
            relationTo: opts.eventTypesSlug as import("payload").CollectionSlug,
            required: true,
            filterOptions: ({ data }) => {
              const ids = relationIds(
                (data as { allowedEventTypes?: unknown } | undefined)?.allowedEventTypes,
              );
              if (ids.length === 0) return false;
              return { id: { in: ids } };
            },
          },
          ...(opts.countName === "sessions"
            ? [
                {
                  type: "row" as const,
                  fields: [
                    {
                      name: opts.countName,
                      label: opts.countLabel,
                      type: "number" as const,
                      required: true,
                      min: 1,
                    },
                    {
                      name: "intervalCount",
                      label: "Per",
                      type: "number" as const,
                      required: false,
                      min: 1,
                      admin: {
                        description: "Leave blank, with Interval, to use the plan's period.",
                      },
                    },
                    {
                      name: "interval",
                      label: "Interval",
                      type: "select" as const,
                      required: false,
                      options: [
                        { label: "Days", value: "day" },
                        { label: "Weeks", value: "week" },
                        { label: "Months", value: "month" },
                        { label: "Quarters", value: "quarter" },
                        { label: "Years", value: "year" },
                      ],
                      admin: {
                        description: "Leave blank, with Per, to use the plan's period.",
                      },
                    },
                  ],
                } satisfies Field,
              ]
            : [
                {
                  name: opts.countName,
                  label: opts.countLabel,
                  type: "number" as const,
                  required: true,
                  min: 1,
                } satisfies Field,
              ]),
          maxBookingsPerTimeslotOverrideField(opts.capDescription),
        ],
      },
    ],
  };
}

import type { Field } from "payload";
import { sessionIntervalSelectOptions } from "@repo/shared-services";

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
        label: "Shared allowances",
        labels: {
          singular: "Shared allowance",
          plural: "Shared allowances",
        },
        type: "array",
        admin: { description: opts.description },
        fields: [
          {
            name: "eventTypes",
            label: "Event types",
            type: "relationship",
            relationTo: opts.eventTypesSlug as import("payload").CollectionSlug,
            hasMany: true,
            required: true,
            admin: {
              description: "These types share this row's allowance. A type can be on only one row.",
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
                      options: sessionIntervalSelectOptions(),
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

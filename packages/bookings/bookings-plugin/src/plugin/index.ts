import type { Config, CollectionSlug, Plugin } from "payload";

import { generateTimeslotCollection } from "../collections/timeslots";
import { generateEventTypesCollection } from "../collections/event-types";
import { generateBookingCollection } from "../collections/bookings";

import { BookingsPluginConfig } from "../types";

import { createSchedulerGlobal } from "../globals/scheduler";

import { createGenerateTimeslotsFromScheduleHandler } from "../tasks/create-generate-timeslots-handler";

import { resolveBookingCollectionSlugs } from "../resolve-slugs";

function createGenerateTimeslotsTaskInputSchema(slugs: {
  eventTypes: string;
}) {
  const eventTypesSlug = slugs.eventTypes as CollectionSlug;

  return [
    {
      name: "startDate",
      type: "date" as const,
      required: true,
    },
    {
      name: "endDate",
      type: "date" as const,
      required: true,
    },
    {
      name: "week",
      type: "group" as const,
      required: true,
      fields: [
        {
          name: "days",
          type: "array" as const,
          required: true,
          minRows: 7,
          maxRows: 7,
          fields: [
            {
              name: "timeSlot",
              type: "array" as const,
              required: true,
              fields: [
                {
                  name: "startTime",
                  type: "date" as const,
                  required: true,
                },
                {
                  name: "endTime",
                  type: "date" as const,
                  required: true,
                },
                {
                  name: "eventType",
                  type: "relationship" as const,
                  relationTo: eventTypesSlug,
                },
                {
                  name: "location",
                  type: "text" as const,
                },
                {
                  name: "staffMember",
                  type: "relationship" as const,
                  relationTo: "users" as CollectionSlug,
                },
                {
                  name: "lockOutTime",
                  type: "number" as const,
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "clearExisting",
      type: "checkbox" as const,
      required: true,
    },
    {
      name: "defaultEventType",
      type: "relationship" as const,
      relationTo: eventTypesSlug,
      required: true,
    },
    {
      name: "lockOutTime",
      type: "number" as const,
      required: true,
    },
    {
      name: "branch",
      type: "number" as const,
      required: false,
      admin: {
        description:
          "When the tenant has multiple active sites (locations), set this to the `locations` id for generated timeslots. Optional if there is only one active site.",
      },
    },
  ];
}

export const bookingsPlugin =
  (pluginOptions: BookingsPluginConfig): Plugin =>
  (incomingConfig: Config) => {
    const config = { ...incomingConfig };

    if (!pluginOptions.enabled) {
      return config;
    }

    const slugs = resolveBookingCollectionSlugs(pluginOptions);

    // Copy arrays so we never mutate the caller's collections/globals (shared test
    // configs and Payload's shallow plugin clones would otherwise accumulate duplicates).
    const collections = [...(config.collections || [])];

    const timeslots = generateTimeslotCollection(pluginOptions, slugs);
    const eventTypes = generateEventTypesCollection(pluginOptions, slugs);
    const bookings = generateBookingCollection(pluginOptions, slugs);

    collections.push(timeslots);
    collections.push(eventTypes);
    collections.push(bookings);

    const globals = [...(config.globals || [])];

    globals.push(createSchedulerGlobal(slugs));

    config.globals = globals;

    config.collections = collections;

    if (!config.jobs) {
      config.jobs = {
        tasks: [],
      };
    }

    if (!config.jobs.tasks) {
      config.jobs.tasks = [];
    }

    config.jobs.tasks.push({
      slug: "generateTimeslotsFromSchedule",
      handler: createGenerateTimeslotsFromScheduleHandler(slugs),
      inputSchema: createGenerateTimeslotsTaskInputSchema(slugs),
    });

    return config;
  };

import type { Config, CollectionSlug, Plugin } from "payload";

import { generateTimeslotCollection } from "../collections/timeslots";
import { generateEventTypesCollection } from "../collections/event-types";
import { generateBookingCollection } from "../collections/bookings";
import { generateStaffMemberCollection } from "../collections/staff-members";

import { BookingsPluginConfig } from "../types";

import { createSchedulerGlobal } from "../globals/scheduler";

import { createGenerateTimeslotsFromScheduleHandler } from "../tasks/create-generate-timeslots-handler";

import { resolveBookingCollectionSlugs } from "../resolve-slugs";

function createGenerateTimeslotsTaskInputSchema(slugs: {
  eventTypes: string;
  staffMembers: string;
}) {
  const eventTypesSlug = slugs.eventTypes as CollectionSlug;
  const staffMembersSlug = slugs.staffMembers as CollectionSlug;

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
                  relationTo: staffMembersSlug,
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

    let collections = config.collections || [];

    const staffMembers = generateStaffMemberCollection(pluginOptions, slugs);
    const timeslots = generateTimeslotCollection(pluginOptions, slugs);
    const eventTypes = generateEventTypesCollection(pluginOptions, slugs);
    const bookings = generateBookingCollection(pluginOptions, slugs);

    collections.push(staffMembers);
    collections.push(timeslots);
    collections.push(eventTypes);
    collections.push(bookings);

    const globals = config.globals || [];

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
      outputSchema: [
        {
          name: "success",
          type: "checkbox",
        },
        {
          name: "message",
          type: "text",
        },
      ],
      onSuccess: async () => {
        console.log("Task completed");
      },
      onFail: async () => {
        console.log("Task failed");
      },
    });

    const timezones = config.admin?.timezones || {
      defaultTimezone: "Europe/Dublin",
    };

    config.admin!.timezones = timezones;

    return config;
  };

import { CollectionConfig } from "payload";
import { getRemainingCapacity } from "../hooks/remaining-capacity";
import { getBookingStatus } from "../hooks/booking-status";

export const lessonsCollection: CollectionConfig = {
  slug: "lessons",
  labels: {
    singular: "Lesson",
    plural: "Lessons",
  },
  access: {
    read: () => true,
  },
  admin: {
    group: "Bookings",
    components: {
      views: {
        list: {
          Component:
            "@repo/bookings/src/components/lessons/fetch-lessons#FetchLessons",
        },
      },
    },
    pagination: {
      defaultLimit: 100,
    },
  },
  fields: [
    {
      type: "row",
      fields: [
        {
          name: "date",
          label: "Date",
          type: "date",
          required: true,
          defaultValue: new Date(),
          localized: true,
          admin: {
            date: {
              displayFormat: "dd/MM/yyyy",
            },
          },
        },
        {
          name: "start_time",
          type: "date",
          required: true,
          admin: {
            date: {
              pickerAppearance: "timeOnly",
            },
          },
          hooks: {
            beforeChange: [
              ({ value, siblingData }) => {
                const date = new Date(siblingData.date);

                // Extract the date parts from value1
                const year = date.getFullYear();
                const month = date.getMonth();
                const day = date.getDate(); // Extract date from sibling data

                const time = new Date(value);

                const hours = time.getHours();
                const minutes = time.getMinutes();
                const seconds = time.getSeconds();
                const milliseconds = time.getMilliseconds();

                value = new Date(
                  year,
                  month,
                  day,
                  hours,
                  minutes,
                  seconds,
                  milliseconds
                );

                return value;
              },
            ],
          },
        },
        {
          name: "end_time",
          type: "date",
          required: true,
          admin: {
            date: {
              pickerAppearance: "timeOnly",
            },
          },
          hooks: {
            beforeChange: [
              ({ value, siblingData }) => {
                const date = new Date(siblingData.date);

                // Extract the date parts from value1
                const year = date.getFullYear();
                const month = date.getMonth();
                const day = date.getDate(); // Extract date from sibling data

                const time = new Date(value);

                const hours = time.getHours();
                const minutes = time.getMinutes();
                const seconds = time.getSeconds();
                const milliseconds = time.getMilliseconds();

                value = new Date(
                  year,
                  month,
                  day,
                  hours,
                  minutes,
                  seconds,
                  milliseconds
                );

                return value;
              },
            ],
          },
          validate: (value, options) => {
            const siblingData = options.siblingData as {
              start_time: string;
            };
            if (value && siblingData.start_time) {
              const endTime = new Date(value);
              const startTime = new Date(siblingData.start_time);
              if (endTime <= startTime) {
                return "End time must be greater than start time";
              }
            }
            return true;
          },
        },
      ],
    },
    {
      type: "row",
      fields: [
        {
          name: "lock_out_time",
          label: "Lock Out Time (minutes)",
          type: "number",
          required: true,
          defaultValue: 60,
        },
        {
          name: "location",
          label: "Location",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "class_option",
      label: "Class Option",
      type: "relationship",
      relationTo: "class-options",
      required: true,
      hasMany: false,
    },
    {
      name: "remaining_capacity",
      type: "number",
      hidden: true,
      virtual: true,
      admin: {
        description: "The number of places remaining",
        readOnly: true,
      },
      hooks: {
        afterRead: [getRemainingCapacity],
      },
    },
    {
      name: "bookings",
      label: "Bookings",
      type: "join",
      collection: "bookings",
      maxDepth: 3,
      hasMany: true,
      on: "lesson",
    },
    {
      name: "booking_status",
      type: "text",
      admin: {
        description: "Status of the lesson",
        readOnly: true,
        hidden: true,
      },
      hooks: {
        afterRead: [getBookingStatus],
      },
      virtual: true,
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        await req.payload.delete({
          collection: "bookings",
          where: {
            lesson: {
              equals: id,
            },
          },
        });
      },
    ],
  },
};

import { CollectionConfig } from "payload";
import { PluginTypes } from "../types";

export const modifyLessonsCollection = (
  pluginOptions: PluginTypes
): CollectionConfig => {
  const collection: CollectionConfig = {
    slug: "lessons",
    labels: {
      singular: "Lesson",
      plural: "Lessons",
    },
    access: {
      read: () => true,
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
    ],
  };

  return collection;
};

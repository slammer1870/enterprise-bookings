import { APIError, CollectionConfig } from "payload";

import { renderCreateAccess, renderUpdateAccess } from "../access/bookings";
import { BookingsPluginConfig } from "../types";

export const bookingsCollection = (
  pluginOptions: BookingsPluginConfig
): CollectionConfig => {
  return {
    slug: "bookings",
    defaultSort: "updatedAt",
    admin: {
      useAsTitle: "user",
      group: "Bookings",
      hidden: true,
    },
    access: {
      //TODO: Add read, update and delete access control
      create: renderCreateAccess(pluginOptions),
      update: renderUpdateAccess(pluginOptions),
    },
    fields: [
      {
        name: "user",
        label: "User",
        type: "relationship",
        relationTo: "users",
        required: true,
      },
      {
        name: "lesson",
        label: "Lesson",
        type: "relationship",
        relationTo: "lessons",
        maxDepth: 3,
        required: true,
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["pending", "confirmed", "cancelled", "waiting"],
        required: true,
      },
    ],
    hooks: {
      beforeValidate: [
        async ({ req, data }) => {
          const lesson = await req.payload.findByID({
            collection: "lessons",
            id: data?.lesson,
            depth: 1,
          });

          const open = (lesson.remainingCapacity as number) > 0;

          //Prevent booking if the lesson is fully booked
          if (!open && data?.status === "confirmed") {
            throw new APIError("This lesson is fully booked", 400);
          }

          return data;
        },
        async ({ req, data, operation }) => {
          if (operation === "create") {
            console.log("data", data);
            const booking = await req.payload.find({
              collection: "bookings",
              where: {
                lesson: {
                  equals: data?.lesson,
                },
                user: {
                  equals: data?.user,
                },
              },
              depth: 3,
            });

            console.log(booking.docs[0]);

            if (booking.docs.length > 0) {
              throw new APIError(
                "A booking with this user already exists for this lesson",
                400
              );
            }
          }
        },
      ],
    },
  };
};

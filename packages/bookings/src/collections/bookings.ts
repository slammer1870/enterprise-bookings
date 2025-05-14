import { APIError, CollectionConfig, CollectionSlug } from "payload";

import { renderCreateAccess, renderUpdateAccess } from "../access/bookings";
import { BookingsPluginConfig } from "../types";
import { Lesson, Transaction, Booking, User } from "@repo/shared-types";
import { render } from "@react-email/components";
import { BookingConfirmationEmail } from "../emails/confirm-booking";

export const bookingsCollection = (
  pluginOptions: BookingsPluginConfig
): CollectionConfig => {
  const config: CollectionConfig = {
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
          const lesson = (await req.payload.findByID({
            collection: "lessons",
            id: data?.lesson,
            depth: 3,
          })) as Lesson;

          const open =
            lesson.bookings.docs.filter(
              (booking: Booking) => booking.status === "confirmed"
            ).length < lesson.classOption.places;

          //Prevent booking if the lesson is fully booked
          if (!open && data?.status === "confirmed") {
            throw new APIError("This lesson is fully booked", 400);
          }

          return data;
        },
      ],
      afterChange: [
        async ({ req, operation, doc }) => {
          if (operation === "update" && doc.status === "cancelled") {
            // Don't block the response by running this asynchronously
            Promise.resolve().then(async () => {
              try {
                if (!doc.transaction || !req.user) return;

                const transaction = (await req.payload.findByID({
                  collection: "transactions",
                  id: doc.transaction,
                  depth: 3,
                })) as Transaction;

                if (transaction.createdBy?.id !== req.user.id) {
                  return;
                }

                await req.payload.update({
                  collection: "bookings",
                  where: {
                    and: [
                      {
                        transaction: {
                          equals: transaction.id,
                        },
                      },
                      {
                        status: {
                          not_equals: "cancelled",
                        },
                      },
                    ],
                  },
                  data: {
                    status: "cancelled",
                  },
                });
              } catch (error) {
                console.error(
                  "Error in bookings afterChange background task:",
                  error
                );
              }
            });
          }

          return doc;
        },
      ],
    },
  };

  if (pluginOptions.paymentMethods) {
    config.fields.push({
      name: "transaction",
      type: "relationship",
      relationTo: "transactions" as CollectionSlug,
    });
  }

  return config;
};

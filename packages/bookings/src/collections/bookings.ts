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

            if (booking.docs.length > 0) {
              throw new APIError(
                "A booking with this user already exists for this lesson",
                400
              );
            }
          }
        },
      ],
      afterChange: [
        async ({ req, operation, doc }) => {
          if (doc.status === "confirmed") {
            Promise.resolve().then(async () => {
              try {
                // Get user details for the email
                const user = await req.payload.findByID({
                  collection: "users",
                  id: doc.user,
                });

                // Get lesson details for the email
                const lesson = await req.payload.findByID({
                  collection: "lessons",
                  id: doc.lesson,
                  depth: 1,
                });

                // Prepare email data
                const emailData = {
                  user,
                  lesson,
                  booking: doc as Booking,
                } as {
                  user: User;
                  lesson: Lesson;
                  booking: Booking;
                  transaction?: Transaction;
                };

                // If there's a transaction associated with this booking, add transaction details
                if (doc.transaction) {
                  const transaction = (await req.payload.findByID({
                    collection: "transactions",
                    id: doc.transaction,
                  })) as Transaction;

                  if (transaction) {
                    emailData.transaction = {
                      id: transaction.id as number,
                      amount: transaction.amount,
                      status: transaction.status,
                      createdAt: transaction.createdAt,
                      paymentMethod: transaction.paymentMethod,
                      createdBy: transaction.createdBy,
                    };
                  }
                }

                const bookingEmail = render(
                  BookingConfirmationEmail(emailData)
                );

                // Send confirmation email
                await req.payload.sendEmail({
                  to: user.email,
                  subject: "Your Booking Confirmation",
                  react: bookingEmail,
                });
              } catch (error) {
                console.error(
                  "Error sending booking confirmation email:",
                  error
                );
              }
            });
          }

          if (operation === "update" && doc.status === "cancelled") {
            // Don't block the response by running this asynchronously
            Promise.resolve().then(async () => {
              try {
                if (!doc.transaction || !req.user) return;

                if (doc.transaction.createdBy.id !== req.user.id) {
                  return;
                }

                await req.payload.update({
                  collection: "bookings",
                  where: {
                    and: [
                      {
                        transaction: {
                          equals: doc.transaction.id,
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

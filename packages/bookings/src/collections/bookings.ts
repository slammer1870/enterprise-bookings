import {
  APIError,
  CollectionAdminOptions,
  CollectionConfig,
  Field,
  Labels,
} from "payload";

import {
  bookingCreateAccess,
  bookingUpdateAccess,
  isAdminOrOwner,
} from "../access/bookings";

import { BookingsPluginConfig, HooksConfig, AccessControls } from "../types";

import { Lesson, Booking, User } from "@repo/shared-types";

import { checkRole } from "@repo/shared-utils/src/check-role";

import { render } from "@react-email/components";
import { WaitlistNotificationEmail } from "../emails/waitlist-notification";

const defaultFields: Field[] = [
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
];

const defaultLabels: Labels = {
  singular: "Booking",
  plural: "Bookings",
};

const defaultAccess: AccessControls = {
  read: ({ req }) => isAdminOrOwner({ req }),
  create: bookingCreateAccess,
  update: bookingUpdateAccess,
  delete: ({ req }) => checkRole(["admin"], req.user as User),
};

const defaultAdmin: CollectionAdminOptions = {
  useAsTitle: "user",
  group: false,
};

const defaultHooks: HooksConfig = {
  beforeValidate: [
    async ({ req, data }) => {
      const lesson = (await req.payload.findByID({
        collection: "lessons",
        id: data?.lesson,
        depth: 3,
      })) as Lesson;

      const closed =
        lesson.bookings.docs.filter(
          (booking: Booking) => booking.status === "confirmed"
        ).length >= lesson.classOption.places;

      //Prevent booking if the lesson is fully booked
      if (closed && data?.status === "confirmed") {
        throw new APIError("This lesson is fully booked", 403);
      }

      return data;
    },
  ],
  afterChange: [
    async ({ req, doc, context }) => {
      if (context.triggerAfterChange) {
        return;
      }

      // Ensure we're passing the lesson ID as a number
      const lessonId =
        typeof doc.lesson === "object" ? doc.lesson.id : doc.lesson;

      const lesson = (await req.payload.findByID({
        collection: "lessons",
        id: lessonId,
        depth: 3,
      })) as Lesson;

      if (doc.status === "cancelled" && lesson.remainingCapacity === 0) {
        const bookingsQuery = await req.payload.find({
          collection: "bookings",
          where: {
            lesson: { equals: lesson.id },
            status: { equals: "waiting" },
          },
          depth: 3,
        });

        const bookings = bookingsQuery.docs as Booking[];

        const emailTemplate = await render(
          WaitlistNotificationEmail({
            lesson: lesson,
            dashboardUrl: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
          })
        );

        bookings.forEach(async (booking) => {
          await req.payload.sendEmail({
            to: booking.user.email,
            subject: "Lesson is now available",
            html: emailTemplate,
          });
        });
      }
    },
  ],
};

export const generateBookingCollection = (config: BookingsPluginConfig) => {
  const bookingConfig: CollectionConfig = {
    ...(config?.bookingOverrides || {}),
    slug: "bookings",
    defaultSort: "updatedAt",
    labels: {
      ...(config?.bookingOverrides?.labels || defaultLabels),
    },
    access: {
      ...(config?.bookingOverrides?.access || defaultAccess),
    },
    admin: {
      ...(config?.bookingOverrides?.admin || defaultAdmin),
    },
    hooks: {
      ...(config?.bookingOverrides?.hooks &&
      typeof config?.bookingOverrides?.hooks === "function"
        ? config.bookingOverrides.hooks({ defaultHooks })
        : defaultHooks),
    },
    fields:
      config?.bookingOverrides?.fields &&
      typeof config?.bookingOverrides?.fields === "function"
        ? config.bookingOverrides.fields({ defaultFields })
        : defaultFields,
  };

  return bookingConfig;
};

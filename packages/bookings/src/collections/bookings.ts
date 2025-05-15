import {
  APIError,
  CollectionAdminOptions,
  CollectionConfig,
  CollectionSlug,
  Field,
  Labels,
} from "payload";

import {
  bookingCreateAccess,
  bookingUpdateAccess,
  isAdminOrOwner,
} from "../access/bookings";
import { BookingsPluginConfig, HooksConfig, AccessControls } from "../types";
import { Lesson, Transaction, Booking, User } from "@repo/shared-types";
import { checkRole } from "@repo/shared-utils/src/check-role";

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
  afterChange: [],
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

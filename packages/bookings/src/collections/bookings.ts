import { APIError, CollectionConfig } from "payload";

import { isAdminOrMember } from "../access/bookings";

export const bookingsCollection: CollectionConfig = {
  slug: "bookings",
  defaultSort: "updatedAt",
  admin: {
    useAsTitle: "user",
    group: "Bookings",
    hidden: true,
  },
  access: {
    //TODO: Add read, update and delete access control
    create: isAdminOrMember,
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
    ],
  },
};

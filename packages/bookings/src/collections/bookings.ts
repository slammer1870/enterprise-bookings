import { APIError, CollectionConfig } from "payload";

export const bookingsCollection: CollectionConfig = {
  slug: "bookings",
  defaultSort: "updated_at",
  admin: {
    useAsTitle: "user",
    group: "Bookings",
    hidden: true,
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

        const open = (lesson.remaining_capacity as number) > 0;

        if (!open && data?.status === "confirmed") {
          throw new APIError("This lesson is fully booked", 400);
        }

        return data;
      },
    ],
  },
};

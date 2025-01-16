import { FieldHook } from "payload";

export const getRemainingCapacity: FieldHook = async ({
  req,
  data,
  context,
}) => {
  if (context.triggerAfterChange === false) {
    return;
  }
  const classOption = await req.payload.findByID({
    collection: "class-options",
    id: data?.classOption,
    depth: 1,
    context: {
      triggerAfterChange: false,
    },
  });

  const bookings = await req.payload.find({
    collection: "bookings",
    depth: 1,
    where: {
      lesson: {
        equals: data?.id,
      },
      status: {
        equals: "confirmed",
      },
    },
    context: {
      triggerAfterChange: false,
    },
  });
  const remaining = classOption.places - bookings.docs.length;

  return remaining;
};

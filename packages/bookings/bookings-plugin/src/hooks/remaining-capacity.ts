import { FieldHook } from "payload";

export const getRemainingCapacity: FieldHook = async ({
  req,
  data,
  context,
}) => {
  if (context.triggerAfterChange === false) {
    return;
  }

  if (!data?.classOption) {
    return 0;
  }

  try {
    const classOptionId =
      typeof data.classOption === "object" && data.classOption !== null
        ? data.classOption.id
        : data.classOption;

    if (!classOptionId) {
      return 0;
    }

    const classOption = await req.payload.findByID({
      collection: "class-options",
      id: classOptionId,
      depth: 1,
      context: {
        triggerAfterChange: false,
      },
    });

    if (!classOption) {
      return 0;
    }

    if (!data?.id) {
      return classOption.places;
    }

    const bookings = await req.payload.find({
      collection: "bookings",
      depth: 1,
      where: {
        lesson: {
          equals: data.id,
        },
        status: {
          equals: "confirmed",
        },
      },
      limit: 0,
      context: {
        triggerAfterChange: false,
      },
    });

    const remaining = classOption.places - bookings.docs.length;

    return remaining;
  } catch (error: any) {
    // Silently handle cases where class-option or lesson was deleted (e.g., during test cleanup)
    if (
      error?.status === 404 ||
      error?.name === "NotFound" ||
      error?.message?.includes("Cannot read properties of undefined")
    ) {
      return 0;
    }
    // Re-throw other errors
    throw error;
  }
};

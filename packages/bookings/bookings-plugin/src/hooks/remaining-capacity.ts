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

    // Count confirmed + pending (pending only if created in last 5 min so abandoned checkout frees the spot quickly)
    const pendingCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const bookings = await req.payload.find({
      collection: "bookings",
      depth: 1,
      where: {
        and: [
          { lesson: { equals: data.id } },
          {
            or: [
              { status: { equals: "confirmed" } },
              {
                and: [
                  { status: { equals: "pending" } },
                  { createdAt: { greater_than: pendingCutoff } },
                ],
              },
            ],
          },
        ],
      },
      limit: 0,
      context: {
        triggerAfterChange: false,
      },
    });

    const remaining = classOption.places - bookings.totalDocs;

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

import { Lesson } from "@repo/shared-types";
import { CollectionAfterChangeHook } from "payload";

export const setLockout: CollectionAfterChangeHook = async ({
  req,
  doc,
  context,
}) => {
  if (context.triggerAfterChange === false) {
    return;
  }

  const lessonId = typeof doc.lesson === "object" ? doc.lesson.id : doc.lesson;

  const confirmed = doc.status === "confirmed";

  Promise.resolve()
    .then(async () => {
      if (confirmed) {
        await req.payload.update({
          collection: "lessons",
          id: lessonId,
          data: {
            lockOutTime: 0,
          },
        });
        return doc;
      }

      const lesson = (await req.payload.findByID({
        collection: "lessons",
        id: lessonId,
        depth: 2,
      })) as Lesson;

      if (
        !lesson.bookings?.docs
          ?.filter((booking) => booking.id != doc.id)
          .some((booking) => booking.status === "confirmed")
      ) {
        await req.payload.update({
          collection: "lessons",
          id: lessonId,
          data: {
            lockOutTime: lesson.originalLockOutTime,
          },
        });
        return doc;
      }

      return doc;
    })
    .catch((error) => {
      // Silently handle cases where lesson was deleted (e.g., during test cleanup)
      if (error.status === 404 || error.name === "NotFound") {
        return;
      }
      // Re-throw other errors
      throw error;
    });
};

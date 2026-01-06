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

  // This hook is only relevant when `doc` is a Booking-like shape (has `lesson` + `status`).
  // It is attached in some contexts where `doc` may be a Lesson, so guard defensively.
  const bookingLike = doc as any;
  const lessonRel = bookingLike?.lesson;
  const status = bookingLike?.status;

  if (!lessonRel || !status) {
    return;
  }

  const lessonId = typeof lessonRel === "object" ? lessonRel.id : lessonRel;

  if (!lessonId) {
    return;
  }

  const confirmed = status === "confirmed";

  try {
    if (confirmed) {
      await req.payload.update({
        collection: "lessons",
        id: lessonId,
        data: {
          lockOutTime: 0,
        },
        context: { triggerAfterChange: false },
      });
      return;
    }

    const lesson = (await req.payload.findByID({
      collection: "lessons",
      id: lessonId,
      depth: 2,
    })) as Lesson;

    if (
      !lesson.bookings?.docs
        ?.filter((booking) => booking.id != bookingLike.id)
        .some((booking) => booking.status === "confirmed")
    ) {
      await req.payload.update({
        collection: "lessons",
        id: lessonId,
        data: {
          lockOutTime: lesson.originalLockOutTime,
        },
        context: { triggerAfterChange: false },
      });
      return;
    }
  } catch (error: any) {
    // Silently handle cases where lesson was deleted (e.g., during test cleanup)
    if (error?.status === 404 || error?.name === "NotFound") {
      return;
    }
    throw error;
  }
};

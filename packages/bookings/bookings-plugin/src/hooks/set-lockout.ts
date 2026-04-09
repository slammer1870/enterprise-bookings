import { Lesson } from "@repo/shared-types";
import type { CollectionAfterChangeHook, CollectionSlug } from "payload";

import type { BookingsPluginSlugs } from "../resolve-slugs";
import { DEFAULT_BOOKINGS_PLUGIN_SLUGS } from "../resolve-slugs";

export function createSetLockout(
  slugs: BookingsPluginSlugs,
): CollectionAfterChangeHook {
  const lessonsSlug = slugs.lessons as CollectionSlug;

  return async ({ req, doc, context }) => {
    if (context.triggerAfterChange === false) {
      return;
    }

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
          collection: lessonsSlug,
          id: lessonId,
          data: {
            lockOutTime: 0,
          },
          context: { triggerAfterChange: false },
        });
        return;
      }

      const lesson = (await req.payload.findByID({
        collection: lessonsSlug,
        id: lessonId,
        depth: 2,
      })) as Lesson;

      if (
        !lesson.bookings?.docs
          ?.filter((booking) => booking.id != bookingLike.id)
          .some((booking) => booking.status === "confirmed")
      ) {
        await req.payload.update({
          collection: lessonsSlug,
          id: lessonId,
          data: {
            lockOutTime: lesson.originalLockOutTime,
          },
          context: { triggerAfterChange: false },
        });
        return;
      }
    } catch (error: any) {
      if (error?.status === 404 || error?.name === "NotFound") {
        return;
      }
      throw error;
    }
  };
}

export const setLockout = createSetLockout(DEFAULT_BOOKINGS_PLUGIN_SLUGS);

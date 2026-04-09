import type { CollectionSlug, FieldHook } from "payload";

import type { BookingsPluginSlugs } from "../resolve-slugs";
import { DEFAULT_BOOKINGS_PLUGIN_SLUGS } from "../resolve-slugs";

export function createGetRemainingCapacity(
  slugs: BookingsPluginSlugs,
): FieldHook {
  const classOptionsSlug = slugs.classOptions as CollectionSlug;
  const bookingsSlug = slugs.bookings as CollectionSlug;

  return async ({ req, data, context }) => {
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

      const classOption = (await req.payload.findByID({
        collection: classOptionsSlug,
        id: classOptionId,
        depth: 1,
        context: {
          triggerAfterChange: false,
        },
      })) as { places?: number } | null;

      if (!classOption) {
        return 0;
      }

      const places = typeof classOption.places === "number" ? classOption.places : 0;

      if (!data?.id) {
        return places;
      }

      const pendingCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const bookings = await req.payload.find({
        collection: bookingsSlug,
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

      const remaining = places - bookings.totalDocs;

      return remaining;
    } catch (error: any) {
      if (
        error?.status === 404 ||
        error?.name === "NotFound" ||
        error?.message?.includes("Cannot read properties of undefined")
      ) {
        return 0;
      }
      throw error;
    }
  };
}

/** @deprecated Prefer createGetRemainingCapacity(slugs) for custom slugs. */
export const getRemainingCapacity = createGetRemainingCapacity(
  DEFAULT_BOOKINGS_PLUGIN_SLUGS,
);

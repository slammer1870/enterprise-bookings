import type { CollectionSlug, Where } from "payload";

type PayloadLike = {
  // Keep loose: callers pass the full Payload instance; we only need find().
  find: (..._args: any[]) => Promise<{ docs: Array<{ id?: number }> }>;
};

export type HasUsedDropInProductArgs = {
  payload: PayloadLike;
  userId: number;
  dropInId: number;
  bookingsSlug?: CollectionSlug | string;
  transactionsSlug?: CollectionSlug | string;
  /** Optional Payload req for transaction continuity. */
  req?: unknown;
};

function toIds(docs: Array<{ id?: number }>): number[] {
  return docs
    .map((b) => (typeof b.id === "number" ? b.id : Number(b.id)))
    .filter((id): id is number => Number.isFinite(id) && id > 0);
}

/**
 * Returns true if the user (or a child account under parentUser) has a prior
 * stripe booking transaction stamped with this drop-in product id.
 */
export async function hasUsedDropInProduct(
  args: HasUsedDropInProductArgs
): Promise<boolean> {
  const {
    payload,
    userId,
    dropInId,
    bookingsSlug = "bookings",
    transactionsSlug = "transactions",
    req,
  } = args;

  if (!Number.isFinite(userId) || userId <= 0) return false;
  if (!Number.isFinite(dropInId) || dropInId <= 0) return false;

  try {
    // Prefer family-aware query; fall back to user-only if nested path is unsupported.
    let bookingIds: number[] = [];
    const familyWhere: Where = {
      or: [
        { user: { equals: userId } },
        { "user.parentUser": { equals: userId } },
      ],
    };

    try {
      const familyBookings = await payload.find({
        collection: bookingsSlug,
        where: familyWhere,
        depth: 0,
        limit: 200,
        overrideAccess: true,
        select: { id: true },
        ...(req ? { req } : {}),
      });
      bookingIds = toIds(familyBookings.docs);
    } catch {
      const ownBookings = await payload.find({
        collection: bookingsSlug,
        where: { user: { equals: userId } },
        depth: 0,
        limit: 200,
        overrideAccess: true,
        select: { id: true },
        ...(req ? { req } : {}),
      });
      bookingIds = toIds(ownBookings.docs);
    }

    if (bookingIds.length === 0) return false;

    const txns = await payload.find({
      collection: transactionsSlug,
      where: {
        and: [
          { booking: { in: bookingIds } },
          { paymentMethod: { equals: "stripe" } },
          { dropInId: { equals: dropInId } },
        ],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      ...(req ? { req } : {}),
    });

    return (txns.docs?.length ?? 0) > 0;
  } catch {
    // Fail open so checkout is not blocked if the eligibility query errors.
    return false;
  }
}

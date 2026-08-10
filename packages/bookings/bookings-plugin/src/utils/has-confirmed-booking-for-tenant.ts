import type { CollectionSlug } from "payload";

type PayloadLike = {
  find: (..._args: any[]) => Promise<{ docs: unknown[] }>;
};

export type HasConfirmedBookingForTenantArgs = {
  payload: PayloadLike;
  userId: number;
  /** When null/undefined, tenant is not filtered (legacy / single-tenant). */
  tenantId?: number | null;
  bookingsSlug?: CollectionSlug | string;
  /** Optional Payload req for transaction continuity / tenant context. */
  req?: unknown;
};

function tenantClauses(
  tenantId: number | null | undefined,
): Array<Record<string, unknown>> {
  return tenantId != null ? [{ tenant: { equals: tenantId } }] : [];
}

/**
 * Returns true if the user (or a child under parentUser) has any confirmed
 * booking for the given tenant. Used for trial CTA / trial discount eligibility.
 */
export async function hasConfirmedBookingForTenant(
  args: HasConfirmedBookingForTenantArgs,
): Promise<boolean> {
  const {
    payload,
    userId,
    tenantId = null,
    bookingsSlug = "bookings",
    req,
  } = args;

  if (!Number.isFinite(userId) || userId <= 0) return false;

  const baseAnd = [
    { status: { equals: "confirmed" as const } },
    ...tenantClauses(tenantId),
  ];

  try {
    const ownConfirmed = await payload.find({
      collection: bookingsSlug,
      where: {
        and: [{ user: { equals: userId } }, ...baseAnd],
      },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      ...(req ? { req } : {}),
    });

    if ((ownConfirmed?.docs?.length ?? 0) > 0) return true;

    try {
      const childConfirmed = await payload.find({
        collection: bookingsSlug,
        where: {
          and: [{ "user.parentUser": { equals: userId } }, ...baseAnd],
        },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        ...(req ? { req } : {}),
      });
      return (childConfirmed?.docs?.length ?? 0) > 0;
    } catch {
      // Nested parentUser unsupported — keep user-only result.
      return false;
    }
  } catch {
    // Prefer failing closed for trial eligibility (non-trialable).
    return true;
  }
}

import type { CollectionSlug } from "payload";

type PayloadLike = {
  find: (..._args: any[]) => Promise<{ docs: unknown[] }>;
};

export type HasConfirmedBookingForTenantArgs = {
  payload: PayloadLike;
  /** Better Auth may supply string ids; numeric strings are accepted. */
  userId: number | string;
  /** When null/undefined, tenant is not filtered (legacy / single-tenant). */
  tenantId?: number | string | null;
  bookingsSlug?: CollectionSlug | string;
  /** Optional Payload req for transaction continuity / tenant context. */
  req?: unknown;
};

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function tenantClauses(
  tenantId: number | null,
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
    bookingsSlug = "bookings",
    req,
  } = args;

  const userId = toPositiveInt(args.userId);
  if (userId == null) return false;

  const tenantId = toPositiveInt(args.tenantId ?? null);

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

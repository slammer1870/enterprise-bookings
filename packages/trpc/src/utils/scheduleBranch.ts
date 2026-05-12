import type { Payload } from "payload";

import { hasCollection } from "./collections";

/**
 * Public branch picker cookie — must match `PUBLIC_BRANCH_SLUG_COOKIE` in atnd-me
 * (`apps/atnd-me/src/utilities/tenantRequest.ts`) and middleware.
 */
export const PUBLIC_BRANCH_SLUG_COOKIE_NAME = "branch-slug";

export function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (cookieHeader == null || cookieHeader === "") return null;
  const segments = cookieHeader.split(";");
  for (const segment of segments) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;
    const key = segment.slice(0, idx).trim();
    if (key !== name) continue;
    const raw = segment.slice(idx + 1).trim();
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(raw);
      return decoded.trim() || null;
    } catch {
      return raw.trim() || null;
    }
  }
  return null;
}

async function findActiveLocationIdBySlug(
  payload: Payload,
  tenantId: number,
  slug: string,
): Promise<number | null> {
  if (!hasCollection(payload, "locations")) return null;
  const res = await payload.find({
    collection: "locations",
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { slug: { equals: slug } },
        { active: { equals: true } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const id = (res.docs[0] as { id?: unknown } | undefined)?.id;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

async function listActiveLocationIds(payload: Payload, tenantId: number): Promise<number[]> {
  if (!hasCollection(payload, "locations")) return [];
  const res = await payload.find({
    collection: "locations",
    where: {
      and: [{ tenant: { equals: tenantId } }, { active: { equals: true } }],
    },
    limit: 3,
    depth: 0,
    overrideAccess: true,
  });
  return (res.docs as { id?: unknown }[])
    .map((d) => d.id)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
}

async function validateBranchForTenant(
  payload: Payload,
  tenantId: number,
  branchId: number,
): Promise<boolean> {
  if (!hasCollection(payload, "locations")) return false;
  const doc = await payload
    .findByID({
      collection: "locations",
      id: branchId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);
  if (!doc) return false;
  const t = (doc as { tenant?: unknown }).tenant;
  const tid =
    typeof t === "object" && t !== null && "id" in t ? (t as { id: unknown }).id : t;
  if (tid !== tenantId) return false;
  if ((doc as { active?: unknown }).active === false) return false;
  return true;
}

export type ResolveGetByDateBranchResult =
  | { branchId: number; whereMode: "strict" | "singleOrUnassigned" }
  | { branchId: null; whereMode: "none" }
  | { error: "invalid_branch_input" };

/**
 * Resolves optional branch scope for `timeslots.getByDate`:
 * - Explicit `branchId` input (validated against tenant + active).
 * - Else `branch-slug` cookie → active `locations` row for tenant.
 * - Else exactly one active location for tenant → auto-pick (legacy timeslots may have `branch` null).
 * - Else no branch filter (all branches + unassigned rows).
 */
export async function resolveGetByDateBranch(
  payload: Payload,
  args: {
    tenantId: number | null;
    inputBranchId?: number | null;
    cookieHeader: string | null;
  },
): Promise<ResolveGetByDateBranchResult> {
  const { tenantId, inputBranchId, cookieHeader } = args;
  if (tenantId == null || !hasCollection(payload, "locations")) {
    return { branchId: null, whereMode: "none" };
  }

  if (inputBranchId != null && Number.isFinite(inputBranchId)) {
    const ok = await validateBranchForTenant(payload, tenantId, inputBranchId);
    if (!ok) return { error: "invalid_branch_input" };
    return { branchId: inputBranchId, whereMode: "strict" };
  }

  const slug = parseCookieValue(cookieHeader, PUBLIC_BRANCH_SLUG_COOKIE_NAME);
  if (slug) {
    const id = await findActiveLocationIdBySlug(payload, tenantId, slug);
    if (id != null) return { branchId: id, whereMode: "strict" };
  }

  const ids = await listActiveLocationIds(payload, tenantId);
  if (ids.length === 1) {
    return { branchId: ids[0]!, whereMode: "singleOrUnassigned" };
  }

  return { branchId: null, whereMode: "none" };
}

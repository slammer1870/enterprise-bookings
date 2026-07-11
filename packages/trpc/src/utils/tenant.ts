import type { Payload } from "payload";
import { TRPCError } from "@trpc/server";

import { findSafe, findByIdSafe, hasCollection } from "./collections";
import { DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS } from "../bookings-slugs";
import type { EventType, Timeslot } from "@repo/shared-types";
import { resolveTimeZone } from "@repo/shared-utils";

export type TenantContext = {
  headers: Headers;
  hostOverride?: string;
};

/** When true on `req.context`, admin `payload-location` branch scoping is skipped (public booking reads). */
export const PAYLOAD_CTX_SKIP_ADMIN_BRANCH_FILTER = "skipAdminBranchFilter" as const;

/**
 * Minimal Payload `req` for Local API calls from tRPC so tenant-scoped collection access
 * can resolve the active tenant (host, cookies, `context.tenant`).
 * Same shape as `timeslots.getByIdForBooking` (passes headers + optional `context.tenant`).
 */
export function createPayloadLocalReqFromTrpc(args: {
  payload: Payload;
  user: unknown;
  headers: Headers;
  tenantId: number | null;
}): { payload: Payload; user: unknown; headers: Headers; context: Record<string, unknown> } {
  const context: Record<string, unknown> = {
    [PAYLOAD_CTX_SKIP_ADMIN_BRANCH_FILTER]: true,
  };
  if (args.tenantId != null) {
    context.tenant = args.tenantId;
  }
  return {
    payload: args.payload,
    user: args.user,
    headers: args.headers,
    context,
  };
}

/**
 * Extract tenant slug from cookie (tenant-slug=...) or from host (subdomain).
 * e.g. "acme" from "acme.example.com" or "acme.localhost".
 */
export function getTenantSlug(ctx: TenantContext): string | null {
  const cookieHeader = ctx.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(/tenant-slug=([^;]+)/);
  const cookieTenantSlug = cookieMatch?.[1]?.trim()?.toLowerCase() ?? null;

  const host =
    ctx.hostOverride ??
    ctx.headers.get("x-forwarded-host") ??
    ctx.headers.get("host") ??
    "";
  const hostWithoutPort = host.split(":")[0]?.trim() ?? "";
  const parts = hostWithoutPort.split(".");
  const isLocalhost = hostWithoutPort.includes("localhost");

  let hostTenantSlug: string | null = null;
  if (isLocalhost && parts.length > 1 && parts[0] && parts[0] !== "localhost") {
    hostTenantSlug = parts[0];
  } else if (!isLocalhost && parts.length >= 3 && parts[0]) {
    hostTenantSlug = parts[0];
  }

  // Some tenants are served behind an additional label like:
  // - www.<tenant>.<tld> (www is not the tenant slug)
  // - new.<tenant>.<tld>
  // These prefixes are common for marketing/staging domains, so we strip them
  // before attempting to resolve the tenant in the `tenants` collection.
  if (hostTenantSlug != null) {
    const prefix = hostTenantSlug;
    if ((prefix === "www") && parts.length >= 3 && parts[1]) {
      hostTenantSlug = parts[1];
    }
    hostTenantSlug = hostTenantSlug.trim().toLowerCase();
  }

  // If the cookie is stale (e.g. user previously visited tenant A, then navigates to tenant B),
  // prefer the tenant implied by the request host.
  if (hostTenantSlug && cookieTenantSlug && hostTenantSlug !== cookieTenantSlug) {
    return hostTenantSlug;
  }

  return cookieTenantSlug ?? hostTenantSlug;
}

/**
 * Resolve tenant ID from slug. Returns null if tenants collection missing or slug not found.
 */
export async function resolveTenantId(
  payload: Payload,
  tenantSlug: string | null
): Promise<number | null> {
  if (!tenantSlug || !hasCollection(payload, "tenants")) return null;
  try {
    const result = await findSafe(payload, "tenants", {
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const doc = result.docs[0];
    return doc ? (doc.id as number) : null;
  } catch (error) {
    console.error("Error resolving tenant (continuing without tenant filter):", error);
    return null;
  }
}

export async function resolveTenantTimeZone(
  payload: Payload,
  tenantId: number | null,
  fallbackTimeZone: string
): Promise<string> {
  if (!tenantId || !hasCollection(payload, "tenants")) {
    return resolveTimeZone(null, fallbackTimeZone);
  }

  try {
    const tenant = await findByIdSafe<{ timeZone?: string | null }>(
      payload,
      "tenants" as any,
      tenantId,
      {
        depth: 0,
        overrideAccess: true,
      }
    );

    return resolveTimeZone(tenant?.timeZone, fallbackTimeZone);
  } catch (error) {
    console.error("Error resolving tenant timezone (falling back to app default):", error);
    return resolveTimeZone(null, fallbackTimeZone);
  }
}

/**
 * Get numeric ID from a Payload relation (number or populated object with id).
 */
export function getRelationId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    if (typeof id === "number") return id;
    if (typeof id === "string") {
      const n = parseInt(id, 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  return null;
}

export function getTimeslotTenantId(timeslot: Timeslot): number | null {
  return getRelationId(timeslot.tenant);
}

export function getEventTypeId(timeslot: Timeslot): number | null {
  return getRelationId(timeslot.eventType);
}

/**
 * Ensure timeslot belongs to the given tenant; throw NOT_FOUND otherwise.
 */
export function assertTimeslotBelongsToTenant(
  timeslot: Timeslot,
  tenantId: number,
  timeslotId: number
): void {
  const timeslotTenantId = getTimeslotTenantId(timeslot);
  if (timeslotTenantId !== tenantId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Timeslot with id ${timeslotId} not found`,
    });
  }
}

/**
 * Populate timeslot.eventType with full EventType (including paymentMethods) when
 * tenant context exists. Mutates timeslot in place. No-op if event-types missing or fetch fails.
 */
export async function populateTimeslotEventType(
  payload: Payload,
  timeslot: Timeslot,
  eventTypesSlug: string = DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS.eventTypes,
  classPassTypesSlug: string = DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS.classPassTypes
): Promise<void> {
  const coId = getEventTypeId(timeslot);
  if (coId == null || !hasCollection(payload, eventTypesSlug)) return;
  try {
    const populated = await findByIdSafe<EventType>(payload, eventTypesSlug, coId, {
      // We need nested payment-method docs (e.g. DropIn) to include fields like
      // `maxBookingsPerTimeslot` so client logic can correctly cap single-slot
      // booking quantity increases.
      depth: 5,
      overrideAccess: true,
    });
    if (populated) {
      // Avoid `JSON.parse(JSON.stringify(...))` here: Payload document instances can
      // omit `null` keys via `toJSON`, which breaks our "null means unlimited" logic.
      // Shallow-clone into plain objects to preserve explicit `null` values.
      const anyPop = populated as any;
      const plain: any = { ...anyPop };

      // Ensure `paymentMethods.allowedDropIn` includes `maxBookingsPerTimeslot`.
      // The manage-page quantity-cap logic uses:
      //   - `maxBookingsPerTimeslot: null` => unlimited (Infinity)
      //   - `maxBookingsPerTimeslot: number` => cap
      // If Payload serialization omits `maxBookingsPerTimeslot` when it's null,
      // the client may conservatively fall back to `1`. So we backfill from the
      // Drop-in doc whenever the cap is missing/undefined.
      if (plain?.paymentMethods?.allowedDropIn != null) {
        const allowedDropIn: any = plain.paymentMethods.allowedDropIn;
        const dropInId =
          typeof allowedDropIn === "number"
            ? allowedDropIn
            : typeof allowedDropIn === "string"
              ? (() => {
                const n = parseInt(allowedDropIn, 10);
                return Number.isFinite(n) ? n : null;
              })()
              : typeof allowedDropIn?.id === "number"
                ? allowedDropIn.id
                : typeof allowedDropIn?.id === "string"
                  ? (() => {
                    const n = parseInt(allowedDropIn.id, 10);
                    return Number.isFinite(n) ? n : null;
                  })()
                  : null;

        // Always re-fetch the drop-in when we have its ID.
        // Payload can sometimes normalize `null` relationship fields during
        // nested population, and we need the client to see the real semantics:
        //   - `maxBookingsPerTimeslot: null` => unlimited (Infinity)
        if (dropInId != null) {
          const dropInDoc = await findByIdSafe<any>(payload, "drop-ins", dropInId, {
            depth: 0,
            overrideAccess: true,
          });
          if (dropInDoc) {
            plain.paymentMethods.allowedDropIn = {
              ...(typeof allowedDropIn === "object" && allowedDropIn != null ? allowedDropIn : {}),
              maxBookingsPerTimeslot: dropInDoc.maxBookingsPerTimeslot ?? null,
              // If numeric cap is explicitly null, treat as "no per-user cap" in
              // legacy semantics too. Some response shaping paths map
              // `maxBookingsPerTimeslot` null/undefined to `1` based on
              // `adjustable`.
              adjustable: dropInDoc.maxBookingsPerTimeslot === null ? true : dropInDoc.adjustable,
            };
          }
        }
      }

      if (plain?.paymentMethods?.allowedDropIn && typeof plain.paymentMethods.allowedDropIn === 'object') {
        plain.paymentMethods = {
          ...plain.paymentMethods,
          allowedDropIn: { ...plain.paymentMethods.allowedDropIn },
        };
      }
      if (Array.isArray(plain?.paymentMethods?.allowedPlans)) {
        plain.paymentMethods = {
          ...plain.paymentMethods,
          allowedPlans: plain.paymentMethods.allowedPlans.map((p: any) =>
            p?.sessionsInformation ? { ...p, sessionsInformation: { ...p.sessionsInformation } } : p
          ),
        };
      }
      if (Array.isArray(plain?.paymentMethods?.allowedClassPasses)) {
        // Re-fetch each class-pass-type document to preserve `maxBookingsPerTimeslot: null`.
        // Payload serialisation strips null keys during nested population, which would make
        // an explicitly-cleared cap (null = unlimited) indistinguishable from "never set".
        // The manage-page cap logic relies on the explicit null to unlock the + button.
        const backfilledPasses = await Promise.all(
          plain.paymentMethods.allowedClassPasses.map(async (cp: any) => {
            const cloned = cp ? { ...cp } : cp;
            if (!cloned || typeof cloned !== "object") return cloned;
            const cpId =
              typeof cloned.id === "number"
                ? cloned.id
                : typeof cloned.id === "string"
                  ? (() => { const n = parseInt(cloned.id, 10); return Number.isFinite(n) ? n : null; })()
                  : typeof cloned === "number"
                    ? cloned
                    : null;
            if (cpId == null) return cloned;
            const cpDoc = await findByIdSafe<any>(payload, classPassTypesSlug, cpId, {
              depth: 0,
              overrideAccess: true,
            });
            if (!cpDoc) return cloned;
            return {
              ...cloned,
              // Explicitly carry the DB value so the client sees null (unlimited) vs a number.
              maxBookingsPerTimeslot: cpDoc.maxBookingsPerTimeslot ?? null,
            };
          })
        );
        plain.paymentMethods = {
          ...plain.paymentMethods,
          allowedClassPasses: backfilledPasses,
        };
      }

      (timeslot as { eventType: EventType }).eventType = plain as EventType;
    }
  } catch (err) {
    console.error("Failed to populate eventType with payment methods:", err);
  }
}

/**
 * Derive tenant ID from timeslot or its eventType when cookie/host tenant is not set.
 */
export function deriveTenantIdFromTimeslot(timeslot: Timeslot): number | null {
  const fromTimeslot = getTimeslotTenantId(timeslot);
  if (fromTimeslot != null) return fromTimeslot;
  const co = timeslot.eventType;
  if (co != null && typeof co === "object" && "tenant" in co) {
    return getRelationId((co as { tenant?: unknown }).tenant);
  }
  return null;
}

/**
 * Resolve tenant ID from a timeslot by ID (e.g. when cookie/host context is missing).
 * Returns null if timeslots collection missing or timeslot not found.
 *
 * Often paired with {@link resolveTenantIdWithResourceFallback} when loading a specific
 * timeslot by ID under `overrideAccess: false` (see {@link resolveTenantIdForTimeslotRequest}).
 */
export async function resolveTenantIdFromTimeslotId(
  payload: Payload,
  timeslotId: number,
  timeslotsSlug: string = DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS.timeslots
): Promise<number | null> {
  if (!hasCollection(payload, timeslotsSlug)) return null;
  const timeslot = await findByIdSafe<Timeslot>(payload, timeslotsSlug, timeslotId, {
    depth: 0,
    overrideAccess: true,
  });
  return timeslot ? deriveTenantIdFromTimeslot(timeslot) : null;
}

/**
 * Reconcile tenant context from the **request** (host / cookies) with tenant on a
 * **specific resource** being loaded by ID.
 *
 * Use this before Payload `findByID` with `overrideAccess: false` when the procedure
 * targets one concrete document (e.g. `/bookings/[id]`, manage booking). Pass the
 * resource's tenant (from the document or a cheap lookup) as `resourceTenantId`.
 *
 * **When to use**
 * - Single-document reads where the URL/id identifies the resource (booking, manage, checkout).
 * - Stale `tenant-slug` cookies or missing Host on SSR can resolve the wrong tenant; scoping
 *   access to the resource's tenant avoids Payload 403 while still allowing cross-tenant booking
 *   when the user opens another tenant's timeslot.
 *
 * **When not to use**
 * - List/filter queries (`find`, schedules, admin lists): request host/cookie should drive scope.
 * - Writes where the user must act only within their resolved site tenant.
 *
 * **Resolution order**
 * 1. `getTenantSlug(ctx)` → `resolveTenantId` (host beats stale cookie when both are present).
 * 2. If that is null or differs from `resourceTenantId`, use `resourceTenantId`.
 * 3. Callers should still validate the loaded document belongs to the effective tenant
 *    (e.g. `assertTimeslotBelongsToTenant`) after `findByID`.
 */
export async function resolveTenantIdWithResourceFallback(args: {
  payload: Payload;
  ctx: TenantContext;
  /** Tenant id of the document about to be read; null skips resource reconciliation. */
  resourceTenantId: number | null;
}): Promise<number | null> {
  let tenantId = await resolveTenantId(args.payload, getTenantSlug(args.ctx));
  const { resourceTenantId } = args;

  if (resourceTenantId != null && (tenantId == null || tenantId !== resourceTenantId)) {
    tenantId = resourceTenantId;
  }

  return tenantId;
}

/**
 * Timeslot convenience wrapper around {@link resolveTenantIdWithResourceFallback}.
 *
 * Loads the timeslot's tenant (override access) and reconciles it with request context.
 * Used by `timeslots.getById` and `timeslots.getByIdForBooking` before `findByID`.
 */
export async function resolveTenantIdForTimeslotRequest(args: {
  payload: Payload;
  ctx: TenantContext;
  timeslotId: number;
  timeslotsSlug?: string;
}): Promise<number | null> {
  const timeslotsSlug =
    args.timeslotsSlug ?? DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS.timeslots;

  const resourceTenantId = await resolveTenantIdFromTimeslotId(
    args.payload,
    args.timeslotId,
    timeslotsSlug
  );

  return resolveTenantIdWithResourceFallback({
    payload: args.payload,
    ctx: args.ctx,
    resourceTenantId,
  });
}

/**
 * Get tenant ID from a booking-like doc (booking.tenant or booking.timeslot.tenant).
 * Returns null if no tenant on doc (backward compatibility).
 */
export function getDocTenantId(doc: {
  tenant?: unknown;
  timeslot?: { tenant?: unknown } | null;
}): number | null {
  const fromDoc = getRelationId(doc.tenant);
  if (fromDoc != null) return fromDoc;
  if (doc.timeslot != null && typeof doc.timeslot === "object") {
    return getRelationId((doc.timeslot as { tenant?: unknown }).tenant);
  }
  return null;
}

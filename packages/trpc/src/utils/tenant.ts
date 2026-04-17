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
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "number" ? id : null;
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
  eventTypesSlug: string = DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS.eventTypes
): Promise<void> {
  const coId = getEventTypeId(timeslot);
  if (coId == null || !hasCollection(payload, eventTypesSlug)) return;
  try {
    const populated = await findByIdSafe<EventType>(payload, eventTypesSlug, coId, {
      depth: 3,
      overrideAccess: true,
    });
    if (populated) {
      (timeslot as { eventType: EventType }).eventType = JSON.parse(
        JSON.stringify(populated)
      ) as EventType;
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

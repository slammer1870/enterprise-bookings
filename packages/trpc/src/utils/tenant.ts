import type { Payload } from "payload";
import { TRPCError } from "@trpc/server";

import { findSafe, findByIdSafe, hasCollection } from "./collections";
import type { ClassOption, Lesson } from "@repo/shared-types";
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
  const match = cookieHeader.match(/tenant-slug=([^;]+)/);
  if (match?.[1]) return match[1];

  const host =
    ctx.hostOverride ??
    ctx.headers.get("x-forwarded-host") ??
    ctx.headers.get("host") ??
    "";
  const hostWithoutPort = host.split(":")[0]?.trim() ?? "";
  const parts = hostWithoutPort.split(".");
  const isLocalhost = hostWithoutPort.includes("localhost");

  if (isLocalhost && parts.length > 1 && parts[0] && parts[0] !== "localhost") {
    return parts[0];
  }
  if (!isLocalhost && parts.length >= 3 && parts[0]) {
    return parts[0];
  }
  return null;
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

export function getLessonTenantId(lesson: Lesson): number | null {
  return getRelationId(lesson.tenant);
}

export function getClassOptionId(lesson: Lesson): number | null {
  return getRelationId(lesson.classOption);
}

/**
 * Ensure lesson belongs to the given tenant; throw NOT_FOUND otherwise.
 */
export function assertLessonBelongsToTenant(
  lesson: Lesson,
  tenantId: number,
  lessonId: number
): void {
  const lessonTenantId = getLessonTenantId(lesson);
  if (lessonTenantId !== tenantId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Lesson with id ${lessonId} not found`,
    });
  }
}

/**
 * Populate lesson.classOption with full ClassOption (including paymentMethods) when
 * tenant context exists. Mutates lesson in place. No-op if class-options missing or fetch fails.
 */
export async function populateLessonClassOption(
  payload: Payload,
  lesson: Lesson
): Promise<void> {
  const coId = getClassOptionId(lesson);
  if (coId == null || !hasCollection(payload, "class-options")) return;
  try {
    const populated = await findByIdSafe<ClassOption>(payload, "class-options", coId, {
      depth: 3,
      overrideAccess: true,
    });
    if (populated) {
      (lesson as { classOption: ClassOption }).classOption = JSON.parse(
        JSON.stringify(populated)
      ) as ClassOption;
    }
  } catch (err) {
    console.error("Failed to populate classOption with payment methods:", err);
  }
}

/**
 * Derive tenant ID from lesson or its classOption when cookie/host tenant is not set.
 */
export function deriveTenantIdFromLesson(lesson: Lesson): number | null {
  const fromLesson = getLessonTenantId(lesson);
  if (fromLesson != null) return fromLesson;
  const co = lesson.classOption;
  if (co != null && typeof co === "object" && "tenant" in co) {
    return getRelationId((co as { tenant?: unknown }).tenant);
  }
  return null;
}

/**
 * Resolve tenant ID from a lesson by ID (e.g. when cookie/host context is missing).
 * Returns null if lessons collection missing or lesson not found.
 */
export async function resolveTenantIdFromLessonId(
  payload: Payload,
  lessonId: number
): Promise<number | null> {
  if (!hasCollection(payload, "lessons")) return null;
  const lesson = await findByIdSafe<Lesson>(payload, "lessons", lessonId, {
    depth: 0,
    overrideAccess: true,
  });
  return lesson ? deriveTenantIdFromLesson(lesson) : null;
}

/**
 * Get tenant ID from a booking-like doc (booking.tenant or booking.lesson.tenant).
 * Returns null if no tenant on doc (backward compatibility).
 */
export function getDocTenantId(doc: {
  tenant?: unknown;
  lesson?: { tenant?: unknown } | null;
}): number | null {
  const fromDoc = getRelationId(doc.tenant);
  if (fromDoc != null) return fromDoc;
  if (doc.lesson != null && typeof doc.lesson === "object") {
    return getRelationId((doc.lesson as { tenant?: unknown }).tenant);
  }
  return null;
}

import type { BasePayload, CollectionSlug, PayloadRequest } from "payload";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import {
  checkRole,
  PAYLOAD_CTX_CACHED_TENANT_ADMIN_TENANT_IDS,
  rememberTenantSlugResolution,
} from "@repo/shared-utils";
import type { User as SharedUser } from "@repo/shared-types";

/** Tenant ids from a populated users row (`tenants` join + `registrationTenant`). */
function tenantMembershipIdsFromUserDoc(doc: unknown): number[] {
  if (!doc || typeof doc !== "object") return [];
  const o = doc as Record<string, unknown>;
  const tenants = o.tenants;
  if (Array.isArray(tenants) && tenants.length > 0) {
    const ids = tenants
      .map((row: unknown) => {
        if (typeof row === "number") return row;
        if (row && typeof row === "object") {
          const t = (row as { tenant?: unknown }).tenant;
          if (typeof t === "number" && Number.isFinite(t)) return t;
          if (t && typeof t === "object" && t !== null && "id" in t) {
            const id = (t as { id: unknown }).id;
            if (typeof id === "number" && Number.isFinite(id)) return id;
          }
        }
        return null;
      })
      .filter((id): id is number => typeof id === "number");
    if (ids.length > 0) return ids;
  }
  const reg = o.registrationTenant;
  const tid =
    typeof reg === "object" && reg !== null && "id" in reg
      ? (reg as { id: unknown }).id
      : reg;
  return typeof tid === "number" && Number.isFinite(tid) ? [tid] : [];
}

/**
 * Resolve tenant context for admin views from cookies and user membership.
 *
 * Priority:
 * 1. `payload-tenant` cookie (TenantSelector)
 * 2. `tenant-slug` cookie → DB lookup (subdomain)
 * 3. User `tenants` / `registrationTenant` fallback for admin/staff/location-manager
 */
export async function resolveAdminTenantContext(
  payload: BasePayload,
  user: unknown,
  cookieStore: ReadonlyRequestCookies,
  req: PayloadRequest,
): Promise<void> {
  const hasTenantsCollection = payload.config.collections.some(
    (collection) => String(collection.slug) === "tenants",
  );
  const isSuperAdmin = checkRole(["super-admin"], user as unknown as SharedUser);

  const payloadTenant = cookieStore.get("payload-tenant")?.value;
  if (payloadTenant) {
    const tenantId = /^\d+$/.test(payloadTenant) ? Number(payloadTenant) : payloadTenant;
    if (!req.context) req.context = {};
    req.context.tenant = tenantId;
  } else if (!isSuperAdmin && hasTenantsCollection) {
    const tenantSlug = cookieStore.get("tenant-slug")?.value;
    if (tenantSlug) {
      try {
        const tenantResult = await payload.find({
          collection: "tenants" as CollectionSlug,
          where: { slug: { equals: tenantSlug } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });
        if (tenantResult.docs[0]) {
          const tid = tenantResult.docs[0].id;
          const tenantId = typeof tid === "number" ? tid : parseInt(String(tid), 10);
          if (!req.context) req.context = {};
          req.context.tenant = tenantId;
          rememberTenantSlugResolution(req.context, tenantSlug, tenantId);
        }
      } catch (error) {
        console.error("Error looking up tenant in admin view:", error);
      }
    }
  }

  if (
    hasTenantsCollection &&
    !checkRole(["super-admin"], user as unknown as SharedUser) &&
    checkRole(["admin", "staff", "location-manager"], user as unknown as SharedUser)
  ) {
    const rawCtx = req.context?.tenant;
    const missingTenantContext =
      rawCtx === undefined ||
      rawCtx === null ||
      rawCtx === "" ||
      (typeof rawCtx === "number" && !Number.isFinite(rawCtx));
    if (missingTenantContext) {
      try {
        const idRaw =
          typeof user === "object" && user !== null && "id" in user
            ? (user as { id: unknown }).id
            : null;
        const uid =
          typeof idRaw === "number"
            ? idRaw
            : typeof idRaw === "string"
              ? parseInt(idRaw, 10)
              : NaN;
        if (Number.isFinite(uid)) {
          const full = await payload.findByID({
            collection: "users",
            id: uid,
            depth: 0,
            overrideAccess: true,
            select: {
              tenants: true,
              registrationTenant: true,
            } as any,
          });
          const ids = tenantMembershipIdsFromUserDoc(full);
          if (ids.length > 0) {
            if (!req.context) req.context = {};
            req.context.tenant = ids[0]!;
            req.context[PAYLOAD_CTX_CACHED_TENANT_ADMIN_TENANT_IDS] = ids;
          }
        }
      } catch (error) {
        console.error("Error resolving tenant for timeslots admin view:", error);
      }
    }
  }

  const adminCookieMap = new Map<string, string>();
  if (payloadTenant) adminCookieMap.set("payload-tenant", payloadTenant);
  const rawPayloadLocation = cookieStore.get("payload-location")?.value;
  if (rawPayloadLocation != null) adminCookieMap.set("payload-location", rawPayloadLocation);
  if (adminCookieMap.size > 0) {
    (req as any).cookies = {
      get: (name: string) => {
        const v = adminCookieMap.get(name);
        return v !== undefined ? { value: v } : undefined;
      },
    };
  }
}

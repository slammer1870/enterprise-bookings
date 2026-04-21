import React, { Suspense } from "react";

import Link from "next/link";

import { DatePicker } from "./date-picker";

import { Button, Gutter } from "@payloadcms/ui";
import { Toaster } from "sonner";

import type { BasePayload, CollectionSlug } from "payload";
import { headers } from "next/headers";
import { createLocalReq } from "payload";
import { cookies } from "next/headers";
import {
  checkRole,
  PAYLOAD_CTX_CACHED_TENANT_ADMIN_TENANT_IDS,
  rememberTenantSlugResolution,
} from "@repo/shared-utils";
import type { User as SharedUser } from "@repo/shared-types";

import { TimeslotLoading } from "./timeslot-loading";
import { FetchTimeslots } from "./fetch-timeslots";
import { getTimeslotStartTimeFilter } from "../../utils/timeslot-search-params";

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

export const TimeslotAdmin: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
}> = async ({ searchParams, payload, params }) => {
  const collectionSlug =
    typeof params?.collection === "string"
      ? params.collection
      : typeof params?.segments?.[1] === "string"
        ? params.segments[1]
        : "timeslots";
  const hasTenantsCollection = payload.config.collections.some(
    (collection) => String(collection.slug) === "tenants",
  );
  // Get headers to authenticate user and create req object
  // This allows the multi-tenant plugin to filter timeslots by tenant
  const requestHeaders = await headers();
  const { user } = await payload.auth({ headers: requestHeaders });
  
  // Create a Payload request object with user context
  // The multi-tenant plugin will use this to filter by tenant
  let req = user
    ? await createLocalReq({ user }, payload)
    : undefined;

  const cookieStore = await cookies();
  // Only super-admins are "global tenant picker" users. Org admins use role `admin` too after
  // RBAC renamed `tenant-admin` → `admin`; treating them like super-admin skipped subdomain /
  // membership fallbacks and broke `/admin/collections/timeslots` on the base host.
  const isSuperAdmin = user && checkRole(["super-admin"], user as unknown as SharedUser);

  // 1) Respect admin TenantSelector: when user picks a tenant, filter to that tenant.
  // The multi-tenant plugin sets the selected tenant in the 'payload-tenant' cookie.
  const payloadTenant = cookieStore.get('payload-tenant')?.value;
  if (payloadTenant && req) {
    const tenantId = /^\d+$/.test(payloadTenant) ? Number(payloadTenant) : payloadTenant;
    if (!req.context) req.context = {};
    req.context.tenant = tenantId;
  } else if (!isSuperAdmin && req && hasTenantsCollection) {
    // 2) Fallback: tenant from subdomain (tenant-slug, set by middleware)
    const tenantSlug = cookieStore.get('tenant-slug')?.value;
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
          const tenantId = typeof tid === 'number' ? tid : parseInt(String(tid), 10);
          if (!req.context) req.context = {};
          req.context.tenant = tenantId;
          rememberTenantSlugResolution(req.context, tenantSlug, tenantId);
        }
      } catch (error) {
        console.error('Error looking up tenant in admin view:', error);
      }
    }
  }

  // 3) Base-host admin sessions often lack `tenant-slug`. Resolve tenant from the user row.
  if (
    req &&
    hasTenantsCollection &&
    user &&
    !checkRole(["super-admin"], user as unknown as SharedUser) &&
    checkRole(["admin", "staff"], user as unknown as SharedUser)
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

  const selectedDateISO = getTimeslotStartTimeFilter(searchParams);

  return (
    <Gutter className="!pt-0">
      <div className="flex flex-row justify-start items-center mb-4 gap-3">
        <h1>Timeslots</h1>
        <Link
          href={{
            pathname: `/admin/collections/${collectionSlug}/create`,
          }}
        >
          <Button buttonStyle="pill" size="small" className="whitespace-nowrap">
            Create New
          </Button>
        </Link>
        <span className="flex-1" />
        <div
          id="timeslots-bulk-bar-portal"
          className="flex items-center justify-end min-h-[2.5rem]"
        />
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="mb-8 md:mb-0 md:mr-8">
          <DatePicker selectedDateISO={selectedDateISO} />
        </div>
        <div className="flex flex-col w-full">
          <Suspense
            key={[
              selectedDateISO,
              req?.context?.tenant ?? "all",
            ]
              .filter(Boolean)
              .join("|")}
            fallback={<TimeslotLoading />}
          >
            <FetchTimeslots
              payload={payload}
              searchParams={searchParams}
              params={params}
              req={req}
            />
          </Suspense>
        </div>
      </div>
      <Toaster />
    </Gutter>
  );
};

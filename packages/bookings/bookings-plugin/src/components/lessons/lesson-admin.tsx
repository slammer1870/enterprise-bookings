import React, { Suspense } from "react";

import Link from "next/link";

import { DatePicker } from "./date-picker";

import { Button, Gutter } from "@payloadcms/ui";

import { Toaster } from "sonner";

import { BasePayload } from "payload";
import { headers } from "next/headers";
import { createLocalReq } from "payload";
import { cookies } from "next/headers";
import { checkRole } from "@repo/shared-utils";
import type { User as SharedUser } from "@repo/shared-types";

import { LessonLoading } from "./lesson-loading";
import { FetchLessons } from "./fetch-lessons";

export const LessonAdmin: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
}> = async ({ searchParams, payload, params }) => {
  // Get headers to authenticate user and create req object
  // This allows the multi-tenant plugin to filter lessons by tenant
  const requestHeaders = await headers();
  const { user } = await payload.auth({ headers: requestHeaders });
  
  // Create a Payload request object with user context
  // The multi-tenant plugin will use this to filter by tenant
  let req = user
    ? await createLocalReq({ user }, payload)
    : undefined;

  const cookieStore = await cookies();
  const isAdmin = user && checkRole(['admin'], user as unknown as SharedUser);

  // 1) Respect admin TenantSelector: when user picks a tenant, filter to that tenant.
  // The multi-tenant plugin sets the selected tenant in the 'payload-tenant' cookie.
  const payloadTenant = cookieStore.get('payload-tenant')?.value;
  if (payloadTenant && req) {
    const tenantId = /^\d+$/.test(payloadTenant) ? Number(payloadTenant) : payloadTenant;
    if (!req.context) req.context = {};
    req.context.tenant = tenantId;
  } else if (!isAdmin && req) {
    // 2) Fallback: tenant from subdomain (tenant-slug, set by middleware)
    const tenantSlug = cookieStore.get('tenant-slug')?.value;
    if (tenantSlug) {
      try {
        const tenantResult = await payload.find({
          collection: 'tenants',
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
        }
      } catch (error) {
        console.error('Error looking up tenant in admin view:', error);
      }
    }
  }

  return (
    <Gutter>
      <div className="flex flex-row justify-start items-center mb-4 gap-3">
        <h1>Lessons</h1>
        <Link
          href={{
            pathname: "/admin/collections/lessons/create",
          }}
        >
          <Button buttonStyle="pill" size="small" className="whitespace-nowrap">
            Create New
          </Button>
        </Link>
        <span className="w-full text-center font-medium text-lg hidden md:block"></span>
      </div>
      <div className="flex flex-col md:flex-row">
        <div className="mb-8 md:mb-0 md:mr-8">
          <DatePicker />
        </div>
        <div className="flex flex-col w-full">
          <Suspense
            key={[
              searchParams["where[or][0][and][0][startTime][greater_than_equal]"] as string,
              req?.context?.tenant ?? "all",
            ]
              .filter(Boolean)
              .join("|")}
            fallback={<LessonLoading />}
          >
            <FetchLessons
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

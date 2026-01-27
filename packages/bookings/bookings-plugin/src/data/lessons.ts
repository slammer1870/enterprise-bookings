import { BasePayload, PayloadRequest } from "payload";
import { redirect } from "next/navigation";

import { getLessonsQuery } from "@repo/shared-utils";
import { Lesson } from "@repo/shared-types";

import qs from "qs";

export const getLessons = async (
  payload: BasePayload,
  searchParams: { [key: string]: string | string[] | undefined },
  params: any,
  req?: PayloadRequest
) => {
  const startQuery = "where[or][0][and][0][startTime][greater_than_equal]";

  const condition = searchParams && searchParams[startQuery];

  if (!condition) {
    const query = getLessonsQuery(new Date());

    redirect(`/admin/collections/lessons${query}`);
  }

  const ps = qs.parse(searchParams as unknown as string, {
    ignoreQueryPrefix: true,
    depth: 6,
  });

  // segments: ['admin', 'collections', 'lessons'] -> use 'lessons'
  const collection =
    (params?.segments && params.segments[params.segments.length - 1]) || "lessons";
  const searchQuery = { collection, ...ps } as Record<string, unknown>;

  // When req.context.tenant is set, explicitly filter by tenant (multi-tenant plugin may not apply it for this find)
  const tenantId = req?.context?.tenant
    ? typeof (req.context.tenant as unknown) === "object" && (req.context.tenant as any)?.id != null
      ? (req.context.tenant as any).id
      : (req.context.tenant as number | string)
    : undefined;
  if (tenantId != null) {
    const baseWhere = (searchQuery.where as object) ?? {};
    searchQuery.where = { and: [baseWhere, { tenant: { equals: tenantId } }] };
  }

  // Pass req to payload.find() so multi-tenant plugin can filter by tenant
  // If req is provided, it will include user context and tenant filtering will be applied
  // IMPORTANT: Set overrideAccess: false when req is provided to enforce access control
  // This ensures tenant filtering and user permissions are respected
  const lessonList = await payload.find({
    collection,
    ...ps,
    ...(tenantId != null ? { where: searchQuery.where } : {}),
    ...(req ? { req, overrideAccess: false } : {}),
  } as Parameters<BasePayload["find"]>[0]);

  const lessons = lessonList.docs as Lesson[];

  return lessons;
};

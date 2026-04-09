import { BasePayload, PayloadRequest } from "payload";

import { getTimeslotsQuery } from "@repo/shared-utils";
import { Timeslot } from "@repo/shared-types";

import { getTimeslotStartTimeFilter, normalizeTimeslotSearchParams } from "../utils/timeslot-search-params";

export const getTimeslots = async (
  payload: BasePayload,
  searchParams: { [key: string]: string | string[] | undefined },
  params: any,
  req?: PayloadRequest
) => {
  const startTimeFilter = getTimeslotStartTimeFilter(searchParams);
  const effectiveSearchParams = startTimeFilter ? searchParams : getTimeslotsQuery(new Date()).replace(/^\?/, "");
  const ps = normalizeTimeslotSearchParams(effectiveSearchParams);

  // segments: ['admin', 'collections', 'timeslots'] -> use 'timeslots'
  const collection =
    (params?.segments && params.segments[params.segments.length - 1]) || "timeslots";
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
  const timeslotList = await payload.find({
    collection,
    ...ps,
    ...(tenantId != null ? { where: searchQuery.where } : {}),
    ...(req ? { req, overrideAccess: false } : {}),
  } as Parameters<BasePayload["find"]>[0]);

  const timeslots = timeslotList.docs as Timeslot[];

  return timeslots;
};

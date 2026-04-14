import React from "react";

import { TimeslotsListWithSelection } from "./timeslots-list-with-selection";

import { BasePayload, PayloadRequest } from "payload";

import { checkRole } from "@repo/shared-utils";
import type { Booking, Timeslot, User as SharedUser } from "@repo/shared-types";

import { getTimeslots } from "../../data/timeslots";
import { getTimeslotStartTimeFilter } from "../../utils/timeslot-search-params";

/**
 * Org admins and platform super-admins see all bookings in the expanded row.
 * Staff-only users see confirmed bookings only (matches roster-style visibility).
 */
function timeslotsForStaffConfirmedBookingsOnly(
  timeslots: Timeslot[],
  user: unknown | undefined,
): Timeslot[] {
  const u = user as SharedUser | null | undefined;
  if (
    !u ||
    !checkRole(["staff"], u) ||
    checkRole(["admin"], u) ||
    checkRole(["super-admin"], u)
  ) {
    return timeslots;
  }

  return timeslots.map((ts) => {
    const docs = (ts.bookings?.docs ?? []) as Booking[];
    const confirmedOnly = docs.filter((b) => b.status === "confirmed");
    return {
      ...ts,
      bookings: {
        ...ts.bookings,
        docs: confirmedOnly,
      },
    };
  });
}

export const FetchTimeslots: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
  req?: PayloadRequest;
}> = async ({ searchParams, payload, params, req }) => {
  const raw = await getTimeslots(payload, searchParams, params, req);
  const timeslots = timeslotsForStaffConfirmedBookingsOnly(raw, req?.user);
  const listKey = getTimeslotStartTimeFilter(searchParams) || "default";

  return <TimeslotsListWithSelection timeslots={timeslots} listKey={listKey} />;
};

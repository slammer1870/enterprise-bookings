import React from "react";

import { TimeslotsListWithSelection } from "./timeslots-list-with-selection";

import { BasePayload, PayloadRequest } from "payload";

import { timeslotsForStaffBookingsExcludingPending } from "./staff-booking-visibility";

import { getTimeslots } from "../../data/timeslots";
import { getTimeslotStartTimeFilter } from "../../utils/timeslot-search-params";

export const FetchTimeslots: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
  req?: PayloadRequest;
}> = async ({ searchParams, payload, params, req }) => {
  const _t = Date.now();
  const raw = await getTimeslots(payload, searchParams, params, req);
  console.log(`[FetchTimeslots] getTimeslots total: ${Date.now() - _t}ms, ${raw.length} timeslots`);
  const timeslots = timeslotsForStaffBookingsExcludingPending(raw, req?.user);
  const listKey = getTimeslotStartTimeFilter(searchParams) || "default";

  return <TimeslotsListWithSelection timeslots={timeslots} listKey={listKey} />;
};

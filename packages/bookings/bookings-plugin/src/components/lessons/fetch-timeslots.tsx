import React from "react";

import { TimeslotsListWithSelection } from "./timeslots-list-with-selection";

import { BasePayload, PayloadRequest } from "payload";

import { getTimeslots } from "../../data/timeslots";
import { getTimeslotStartTimeFilter } from "../../utils/timeslot-search-params";

export const FetchTimeslots: React.FC<{
  params: any;
  searchParams: { [key: string]: string | string[] | undefined };
  payload: BasePayload;
  req?: PayloadRequest;
}> = async ({ searchParams, payload, params, req }) => {
  const timeslots = await getTimeslots(payload, searchParams, params, req);
  const listKey = getTimeslotStartTimeFilter(searchParams) || "default";

  return <TimeslotsListWithSelection timeslots={timeslots} listKey={listKey} />;
};

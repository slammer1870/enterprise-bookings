import React from "react";

import { Timeslot } from "@repo/shared-types";

import { TimeslotDetail } from "./lesson-detail";

export function TimeslotList({ timeslots }: { timeslots: Timeslot[] }) {
  return (
    <div className="flex flex-col gap-4 md:gap-8">
      {timeslots && timeslots?.length > 0 ? (
        timeslots?.map((timeslot) => (
          <TimeslotDetail key={timeslot.id} timeslot={timeslot} />
        ))
      ) : (
        <p>No timeslots scheduled for today</p>
      )}
    </div>
  );
}

"use client";

import { ToggleDate } from "@repo/ui/components/toggle-date";

import { useSchedule } from "../../providers/schedule";

import { TimeslotList } from "./lessons/lesson-list";

export const Schedule = () => {
  const { timeslots, isLoading, error, selectedDate, setSelectedDate } =
    useSchedule();

  return (
    <div>
      <ToggleDate date={selectedDate} setDate={setSelectedDate} />
      {!isLoading ? (
        <div>
          <TimeslotList timeslots={timeslots} />
        </div>
      ) : (
        <div>Loading...</div>
      )}
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  );
};

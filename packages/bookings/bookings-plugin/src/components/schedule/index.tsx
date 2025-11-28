"use client";

import { ToggleDate } from "@repo/ui/components/toggle-date";

import { useSchedule } from "../../providers/schedule";

import { LessonList } from "./lessons/lesson-list";

export const Schedule = () => {
  const { lessons, isLoading, error, selectedDate, setSelectedDate } =
    useSchedule();

  return (
    <div>
      <ToggleDate date={selectedDate} setDate={setSelectedDate} />
      {!isLoading ? (
        <div>
          <LessonList lessons={lessons} />
        </div>
      ) : (
        <div>Loading...</div>
      )}
      {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
    </div>
  );
};

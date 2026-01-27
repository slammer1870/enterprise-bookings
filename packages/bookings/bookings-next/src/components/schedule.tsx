"use client";

import { useState } from "react";

import { useTRPC } from "@repo/trpc";
import { useQuery } from "@tanstack/react-query";

import { ToggleDate } from "@repo/ui/components/toggle-date";

import { LessonList } from "./lessons/lesson-list";
import { Loader2 } from "lucide-react";

export function Schedule({ 
  manageHref,
}: { 
  /**
   * Optional function or string to generate the manage booking URL.
   * Passed through to CheckInButton components.
   */
  manageHref?: string | ((lessonId: number) => string);
}) {
  const trpc = useTRPC();

  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: lessons, isLoading } = useQuery({
    ...trpc.lessons.getByDate.queryOptions({
      // Date-only string so the requested day matches the UI label (toDateString).
      // toISOString() is UTC and can shift the calendar day near midnight, breaking E2E "tomorrow".
      date: selectedDate.toDateString(),
    }),
    // Always refetch on mount to ensure fresh data after navigation (e.g., after booking)
    // This ensures bookingStatus is recalculated with the latest booking data
    refetchOnMount: 'always',
    // Also refetch when window becomes visible (user returns to tab)
    refetchOnWindowFocus: true,
    // Use a short stale time (1 second) to balance freshness with performance
    // This ensures data is refetched if it's older than 1 second
    staleTime: 1000,
  });

  return (
    <>
      <ToggleDate date={selectedDate} setDate={setSelectedDate} />
      {isLoading ? (
        <div className="flex flex-col justify-start items-center h-full">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <span className="text-sm">Loading schedule...</span>
        </div>
      ) : (
        <LessonList lessons={Array.isArray(lessons) ? lessons : []} manageHref={manageHref} />
      )}
    </>
  );
}

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
      date: selectedDate.toISOString(),
    }),
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

"use client";

import { useState } from "react";

import { useTRPC } from "@repo/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { ToggleDate } from "@repo/ui/components/toggle-date";

import type { LoginToBookUrlResolver } from "./timeslots/checkin-button";
import { TimeslotList } from "./timeslots/timeslot-list";
import { Loader2 } from "lucide-react";

export function Schedule({
  manageHref,
  tenantId,
  loginToBookUrl,
}: {
  /**
   * Optional function or string to generate the manage booking URL.
   * Defaults to `/bookings/[id]/manage` if not provided.
   * Passed through to CheckInButton components.
   */
  manageHref?: string | ((timeslotId: number) => string);
  /**
   * When provided (e.g. on root home page), filter timeslots to this tenant only.
   */
  tenantId?: number;
  /**
   * Override where anonymous users go when tapping Book/Check-in on the schedule
   * (`loginToBook` action). Defaults to `/complete-booking` with a booking callback.
   */
  loginToBookUrl?: LoginToBookUrlResolver;
}) {
  const trpc = useTRPC();

  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: timeslots, isLoading } = useQuery({
    ...trpc.timeslots.getByDate.queryOptions({
      // Use an ISO instant (not locale-dependent strings like toDateString()).
      // Server will interpret the calendar day in the tenant timezone.
      date: selectedDate.toISOString(),
      ...(tenantId != null && { tenantId }),
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
    <div className="space-y-6 text-foreground">
      <ToggleDate date={selectedDate} setDate={setSelectedDate} />
      {isLoading ? (
        <div className="flex h-full flex-col items-center justify-start text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <span className="text-sm">Loading schedule...</span>
        </div>
      ) : (
        <TimeslotList
          timeslots={Array.isArray(timeslots) ? timeslots : []}
          manageHref={manageHref}
          loginToBookUrl={loginToBookUrl}
        />
      )}
    </div>
  );
}

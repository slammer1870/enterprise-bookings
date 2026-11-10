"use client";

import { useEffect, useState } from "react";

import { useTRPC } from "@repo/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { ToggleDate } from "@repo/ui/components/toggle-date";

import type { LoginToBookUrlResolver } from "./timeslots/checkin-button";
import { TimeslotList } from "./timeslots/timeslot-list";
import { Loader2 } from "lucide-react";

export function Schedule({
  manageHref,
  tenantId,
  branchId,
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
   * Filter timeslots to a specific branch / location (`locations.id`).
   * Used by the LocationScopedSchedule block when a visitor picks a branch.
   */
  branchId?: number;
  /**
   * Override where anonymous users go when tapping Book/Check-in on the schedule
   * (`loginToBook` action). Defaults to `/complete-booking` with a booking callback.
   */
  loginToBookUrl?: LoginToBookUrlResolver;
}) {
  const trpc = useTRPC();

  const [selectedDate, setSelectedDate] = useState(new Date());
  // Starts false on the server and the client, so a cached Book row cannot
  // paint before this visit's fetch. A session flag cannot do that: its
  // initializer runs during the server render, where it is always false.
  const [showTimeslots, setShowTimeslots] = useState(false);
  const selectedDateIso = selectedDate.toISOString();

  const {
    data: timeslots,
    isError,
    isSuccess,
    isFetchedAfterMount,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    ...trpc.timeslots.getByDate.queryOptions({
      // Use an ISO instant (not locale-dependent strings like toDateString()).
      // Server will interpret the calendar day in the tenant timezone.
      date: selectedDateIso,
      ...(tenantId != null && { tenantId }),
      ...(branchId != null && { branchId }),
    }),
    // Always refetch on mount to ensure fresh data after navigation (e.g., after booking)
    // This ensures bookingStatus is recalculated with the latest booking data
    refetchOnMount: "always",
    // Also refetch when window becomes visible (user returns to tab)
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (isSuccess && isFetchedAfterMount) setShowTimeslots(true);
  }, [isSuccess, isFetchedAfterMount, dataUpdatedAt]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // The frozen page still has its pre-payment Book button.
      setShowTimeslots(false);
      void refetch();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refetch]);

  const scheduleReady = showTimeslots && Array.isArray(timeslots);

  return (
    <div className="space-y-6 text-foreground">
      <ToggleDate date={selectedDate} setDate={setSelectedDate} />
      {scheduleReady ? (
        <TimeslotList
          timeslots={timeslots}
          manageHref={manageHref}
          loginToBookUrl={loginToBookUrl}
        />
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the schedule. Refresh the page to try again.
        </p>
      ) : (
        <div className="flex h-full flex-col items-center justify-start text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <span className="text-sm">Loading schedule...</span>
        </div>
      )}
    </div>
  );
}

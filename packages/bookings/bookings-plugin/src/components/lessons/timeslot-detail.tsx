"use client";

import { BookingList } from "../bookings/booking-list";
import { Timeslot, Booking, EventType } from "@repo/shared-types";
import { ManageTimeslot } from "./manage-timeslot";
import { Button, SelectRow } from "@payloadcms/ui";
import { TableRow, TableCell } from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { AddBooking } from "../bookings/add-booking";
import { formatInTimeZone, resolveTimeslotTimeZone } from "@repo/shared-utils/timezone";

export const TimeslotDetail = ({
  timeslot,
  isSelected,
  onToggleSelection,
}: {
  timeslot: Timeslot;
  isSelected?: boolean;
  onToggleSelection?: (_checked: boolean) => void;
}) => {
  const eventType = timeslot.eventType as EventType;
  const [expandedTimeslots, setExpandedTimeslots] = useState<Set<number>>(new Set());
  const [expandedBookings, setExpandedBookings] = useState<Booking[] | null>(null);
  const [isLoadingExpandedBookings, setIsLoadingExpandedBookings] = useState(false);
  const timeZone = resolveTimeslotTimeZone(timeslot);

  const isActive = (timeslot as Timeslot & { active?: boolean }).active !== false;

  const toggleBookings = (timeslotId: number) => {
    setExpandedTimeslots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(timeslotId)) {
        newSet.delete(timeslotId);
      } else {
        newSet.add(timeslotId);
      }
      return newSet;
    });
  };

  const isExpanded = expandedTimeslots.has(timeslot.id);

  const bookingsContainer = timeslot.bookings as unknown as
    | { docs?: Booking[]; totalDocs?: number }
    | undefined;
  const bookingCount =
    typeof bookingsContainer?.totalDocs === "number"
      ? bookingsContainer.totalDocs
      : Array.isArray(bookingsContainer?.docs)
        ? bookingsContainer.docs.length
        : 0;

  useEffect(() => {
    if (!isExpanded) return;

    // Bookings were already loaded once (even if empty) - don't re-fetch.
    if (expandedBookings != null) return;

    // If the list already included docs (rare after we made the list shallow), use them.
    const existingDocs = bookingsContainer?.docs;
    if (Array.isArray(existingDocs) && existingDocs.length > 0) {
      setExpandedBookings(existingDocs);
      return;
    }

    let isCancelled = false;
    setIsLoadingExpandedBookings(true);
    setExpandedBookings(null);

    (async () => {
      try {
        // Fetch the selected timeslot with bookings populated.
        const res = await fetch(
          `/api/timeslots/${timeslot.id}?depth=3`,
          {
            method: "GET",
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        const docs = (data?.bookings?.docs ?? []) as Booking[];
        if (!isCancelled) setExpandedBookings(docs);
      } finally {
        if (!isCancelled) setIsLoadingExpandedBookings(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isExpanded, timeslot.id, expandedBookings]); // timeslot.bookings is intentionally excluded: changes can be frequent.

  return (
    <>
      <TableRow
        key={timeslot.id}
        className={cn(
          "[&_td]:py-1.5",
          !isActive && "opacity-50 hover:opacity-70"
        )}
      >
        <TableCell className="w-10">
          {onToggleSelection != null ? (
            <input
              type="checkbox"
              aria-label={`Select timeslot ${timeslot.id}`}
              checked={isSelected ?? false}
              onChange={(e) => onToggleSelection(e.target.checked)}
            />
          ) : (
            <SelectRow
              rowData={
                {
                  id: String(timeslot.id),
                  _isLocked: false,
                } as Parameters<typeof SelectRow>[0]["rowData"]
              }
            />
          )}
        </TableCell>
        <TableCell>{formatInTimeZone(timeslot.startTime, "HH:mm", timeZone)}</TableCell>
        <TableCell>{formatInTimeZone(timeslot.endTime, "HH:mm", timeZone)}</TableCell>
        <TableCell>{eventType.name}</TableCell>
        <TableCell>
          <Button
            size="small"
            buttonStyle="secondary"
            onClick={() => toggleBookings(timeslot.id)}
          >
            {bookingCount}
            {expandedTimeslots.has(timeslot.id) ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end">
            <ManageTimeslot
              timeslotId={timeslot.id}
              tenantSlug={
                timeslot.tenant &&
                typeof timeslot.tenant === "object" &&
                "slug" in timeslot.tenant
                  ? (timeslot.tenant as { slug?: string }).slug ?? null
                  : undefined
              }
            />
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={6}>
            <div className="rounded-md p-2">
              {isLoadingExpandedBookings ? (
                <div className="text-sm text-muted-foreground">Loading bookings...</div>
              ) : (
                <BookingList bookings={(expandedBookings ?? bookingsContainer?.docs ?? []) as Booking[]} />
              )}
              <AddBooking timeslotId={timeslot.id} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default TimeslotDetail;

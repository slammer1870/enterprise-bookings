"use client";

import { BookingList } from "../bookings/booking-list";
import { Timeslot, Booking, EventType } from "@repo/shared-types";
import { ManageTimeslot } from "./manage-timeslot";
import { Button, SelectRow } from "@payloadcms/ui";
import { TableRow, TableCell } from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [expandedTimeslots, setExpandedTimeslots] = useState<Set<number>>(new Set());
  const [expandedBookings, setExpandedBookings] = useState<Booking[] | null>(null);
  const [isLoadingExpandedBookings, setIsLoadingExpandedBookings] = useState(false);
  const [localBookingTotal, setLocalBookingTotal] = useState<number | null>(null);
  const timeZone = resolveTimeslotTimeZone(timeslot);
  const expandAbortRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    setLocalBookingTotal(null);
    setExpandedBookings(null);
  }, [timeslot.id]);

  const bookingCountFromProps =
    typeof bookingsContainer?.totalDocs === "number"
      ? bookingsContainer.totalDocs
      : Array.isArray(bookingsContainer?.docs)
        ? bookingsContainer.docs.length
        : 0;
  const bookingCount = localBookingTotal ?? bookingCountFromProps;

  const fetchTimeslotBookings = useCallback(
    async (signal?: AbortSignal) => {
      const res = await fetch(`/api/timeslots/${timeslot.id}/bookings`, {
        method: "GET",
        credentials: "include",
        signal,
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch bookings for timeslot ${timeslot.id}`);
      }
      const data = await res.json();
      const docs = (data?.docs ?? []) as Booking[];
      const total =
        typeof data?.totalDocs === "number" ? data.totalDocs : docs.length;
      return { docs, total };
    },
    [timeslot.id],
  );

  const refetchExpandedBookings = useCallback(async () => {
    expandAbortRef.current?.abort();
    const controller = new AbortController();
    expandAbortRef.current = controller;
    try {
      const { docs, total } = await fetchTimeslotBookings(controller.signal);
      setExpandedBookings(docs);
      setLocalBookingTotal(total);
    } catch {
      router.refresh();
    } finally {
      if (expandAbortRef.current === controller) expandAbortRef.current = null;
    }
  }, [fetchTimeslotBookings, router]);

  useEffect(() => {
    if (!isExpanded) return;

    if (expandedBookings != null) return;

    const existingDocs = bookingsContainer?.docs;
    if (Array.isArray(existingDocs) && existingDocs.length > 0) {
      setExpandedBookings(existingDocs);
      return;
    }

    let isCancelled = false;
    expandAbortRef.current?.abort();
    const controller = new AbortController();
    expandAbortRef.current = controller;

    setIsLoadingExpandedBookings(true);
    setExpandedBookings(null);

    (async () => {
      try {
        const { docs, total } = await fetchTimeslotBookings(controller.signal);
        if (!isCancelled) {
          setExpandedBookings(docs);
          setLocalBookingTotal(total);
        }
      } catch {
        if (!isCancelled) router.refresh();
      } finally {
        if (!isCancelled) {
          setIsLoadingExpandedBookings(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
      controller.abort();
      if (expandAbortRef.current === controller) expandAbortRef.current = null;
    };
  }, [isExpanded, timeslot.id, expandedBookings, fetchTimeslotBookings, router]);

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
                <BookingList
                  bookings={(expandedBookings ?? bookingsContainer?.docs ?? []) as Booking[]}
                  onBookingUpdated={refetchExpandedBookings}
                />
              )}
              {!isLoadingExpandedBookings && (
                <AddBooking
                  timeslotId={timeslot.id}
                  onBookingCreated={refetchExpandedBookings}
                />
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default TimeslotDetail;

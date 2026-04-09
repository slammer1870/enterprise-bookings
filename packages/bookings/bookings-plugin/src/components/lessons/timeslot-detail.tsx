"use client";

import { BookingList } from "../bookings/booking-list";
import { Timeslot, Booking, EventType } from "@repo/shared-types";
import { ManageTimeslot } from "./manage-timeslot";
import { Button, SelectRow } from "@payloadcms/ui";
import { TableRow, TableCell } from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
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
  const bookings = timeslot.bookings.docs as Booking[];
  const eventType = timeslot.eventType as EventType;
  const [expandedTimeslots, setExpandedTimeslots] = useState<Set<number>>(new Set());
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
            {timeslot.bookings.docs.length}
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
      {expandedTimeslots.has(timeslot.id) && (
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={6}>
            <div className="rounded-md p-2">
              <BookingList bookings={bookings} />
              <AddBooking timeslotId={timeslot.id} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default TimeslotDetail;

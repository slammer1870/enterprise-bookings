"use client";

import { BookingList } from "../bookings/booking-list";
import { Lesson, Booking, ClassOption } from "@repo/shared-types";
import { ManageLesson } from "./manage-lesson";
import { Button, SelectRow } from "@payloadcms/ui";
import { TableRow, TableCell } from "@repo/ui/components/ui/table";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { AddBooking } from "../bookings/add-booking";

export const LessonDetail = ({
  lesson,
  isSelected,
  onToggleSelection,
}: {
  lesson: Lesson;
  isSelected?: boolean;
  onToggleSelection?: (_checked: boolean) => void;
}) => {
  const bookings = lesson.bookings.docs as Booking[];
  const classOption = lesson.classOption as ClassOption;
  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(new Set());

  const toggleBookings = (lessonId: number) => {
    setExpandedLessons((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  return (
    <>
      <TableRow key={lesson.id}>
        <TableCell className="w-10">
          {onToggleSelection != null ? (
            <input
              type="checkbox"
              aria-label={`Select lesson ${lesson.id}`}
              checked={isSelected ?? false}
              onChange={(e) => onToggleSelection(e.target.checked)}
            />
          ) : (
            <SelectRow
              rowData={
                {
                  id: String(lesson.id),
                  _isLocked: false,
                } as Parameters<typeof SelectRow>[0]["rowData"]
              }
            />
          )}
        </TableCell>
        <TableCell>{format(lesson.startTime, "HH:mm")}</TableCell>
        <TableCell>{format(lesson.endTime, "HH:mm")}</TableCell>
        <TableCell>{classOption.name}</TableCell>
        <TableCell>
          <Button
            size="small"
            buttonStyle="secondary"
            onClick={() => toggleBookings(lesson.id)}
          >
            {lesson.bookings.docs.length}
            {expandedLessons.has(lesson.id) ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end">
            <ManageLesson
              lessonId={lesson.id}
              tenantSlug={
                lesson.tenant &&
                typeof lesson.tenant === "object" &&
                "slug" in lesson.tenant
                  ? (lesson.tenant as { slug?: string }).slug ?? null
                  : undefined
              }
            />
          </div>
        </TableCell>
      </TableRow>
      {expandedLessons.has(lesson.id) && (
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableCell colSpan={6}>
            <div className="rounded-md p-2">
              <BookingList bookings={bookings} />
              <AddBooking lessonId={lesson.id} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default LessonDetail;

"use client";

import { BookingList } from "../bookings/booking-list";

import { Lesson, Booking, ClassOption } from "@repo/shared-types";

import { ManageLesson } from "./manage-lesson";

import { Button } from "@repo/ui/components/ui/button";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@repo/ui/components/ui/table";

import { format } from "date-fns";

import { ChevronDown } from "lucide-react";

import { ChevronUp } from "lucide-react";

import { useState } from "react";

import { AddBooking } from "../bookings/add-booking";

/* eslint-disable-next-line */

const options: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "numeric",
};

export const LessonDetail = ({ lesson }: { lesson: Lesson }) => {
  const bookings = lesson.bookings.docs as Booking[];
  const classOption = lesson.classOption as ClassOption;

  const [expandedLessons, setExpandedLessons] = useState<Set<number>>(
    new Set()
  );

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

  const handleEdit = (lessonId: number) => {
    console.log("Edit lesson", lessonId);
  };

  const handleDelete = (lessonId: number) => {
    console.log("Delete lesson", lessonId);
  };

  return (
    <>
      <TableRow key={lesson.id}>
        <TableCell>{format(lesson.startTime, "HH:mm")}</TableCell>
        <TableCell>{format(lesson.endTime, "HH:mm")}</TableCell>
        <TableCell>{classOption.name}</TableCell>
        <TableCell>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toggleBookings(lesson.id)}
            className="flex items-center border-solid border border-gray-700 dark:border-gray-300 bg-transparent shadow-none"
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
          <ManageLesson lessonId={lesson.id} />
        </TableCell>
      </TableRow>
      {expandedLessons.has(lesson.id) && (
        <TableRow className="bg-gray-100 dark:bg-gray-800">
          <TableCell colSpan={5}>
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

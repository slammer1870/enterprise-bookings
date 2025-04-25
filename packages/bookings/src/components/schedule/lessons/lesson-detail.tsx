import React from "react";

import Image from "next/image";

import { format } from "date-fns";

import { Lesson } from "@repo/shared-types";

import CheckInButton from "./checkin-button";

export function LessonDetail({
  lesson,
  checkinButton,
}: {
  lesson: Lesson;
  checkinButton: React.ReactNode;
}) {
  return (
    <div
      className="w-full flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      key={lesson.id}
    >
      <div>
        <div className="text-sm font-light">
          {format(new Date(lesson.startTime), "HH:mm a")} -{" "}
          {format(new Date(lesson.endTime), "HH:mm a")}
        </div>
        <div className="text-xl font-medium">
          {lesson.classOption.name}{" "}
          {lesson.location && (
            <>
              - <span className="font-normal">{lesson.location}</span>
            </>
          )}
        </div>
        {lesson.instructor && (
          <div className="flex items-center justify-start">
            {lesson.instructor.image && (
              <Image
                src={(lesson.instructor.image.url as string) || ""}
                alt={lesson.classOption.name}
                height={100}
                width={100}
                objectFit="cover"
                className="mr-4 h-12 w-12 rounded-full"
              />
            )}
            <span>{lesson.instructor.name}</span>
          </div>
        )}
        {lesson.bookingStatus !== "closed" && (
          <span className="font-light text-sm">
            {lesson.remainingCapacity} places remaining
          </span>
        )}
      </div>
      <div className="w-full md:w-1/4">
        <CheckInButton lesson={lesson} />
      </div>
    </div>
  );
}

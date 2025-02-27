import React from "react";

import Image from "next/image";

import { format } from "date-fns";

import { Lesson } from "../../../types";

import CheckInButton from "./checkin-button";

export function LessonDetail({ lesson }: { lesson: Lesson }) {
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
        {lesson.user && (
          <div className="flex items-center justify-start py-2">
            {lesson.user.image && (
              <Image
                src={(lesson.user.image.url as string) || ""}
                alt={lesson.classOption.name}
                height={100}
                width={100}
                objectFit="cover"
                className="mr-4 h-12 w-12 rounded-full"
              />
            )}
            <div className="flex flex-col gap-1 items-start justify-start py-2">
              <span>{lesson.user.name}</span>
            </div>
          </div>
        )}
        {lesson.bookingStatus !== "closed" && (
          <span className="font-light text-sm">
            {lesson.remainingCapacity} places remaining
          </span>
        )}
      </div>
      <div className="w-1/4">
        <CheckInButton lesson={lesson} />
      </div>
    </div>
  );
}

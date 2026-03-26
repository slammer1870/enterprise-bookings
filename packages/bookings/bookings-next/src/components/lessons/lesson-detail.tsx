import React from 'react'

import Image from "next/image"

import { ScheduleLesson } from '@repo/shared-types'
import { formatInTimeZone, resolveLessonTimeZone } from '@repo/shared-utils/timezone'

import { CheckInButton } from './checkin-button'

export function LessonDetail({ 
  lesson,
  manageHref,
}: { 
  lesson: ScheduleLesson;
  /**
   * Optional function or string to generate the manage booking URL.
   * Defaults to `/bookings/[id]/manage` if not provided.
   * Passed through to CheckInButton component.
   */
  manageHref?: string | ((lessonId: number) => string);
}) {
  const timeZone = resolveLessonTimeZone(lesson)

  return (
    <div
      className="flex w-full flex-col gap-4 border-b border-border pb-4 last:border-b-0 last:pb-0 md:flex-row md:items-center md:justify-between"
      key={lesson.id}
    >
      <div>
        <div className="text-sm font-light text-muted-foreground">
          {formatInTimeZone(lesson.startTime, 'HH:mm a', timeZone)} -{' '}
          {formatInTimeZone(lesson.endTime, 'HH:mm a', timeZone)}
        </div>
        <div className="text-xl font-medium text-foreground">
          {lesson.classOption.name}{' '}
          {lesson.location && (
            <>
              - <span className="font-normal text-muted-foreground">{lesson.location}</span>
            </>
          )}
        </div>
        {lesson.instructor ? (
          <div className="mt-2 flex items-center justify-start">
            {lesson.instructor.profileImage && (
              <Image
                src={(lesson.instructor.profileImage.url as string) || ''}
                alt={lesson.classOption.name}
                height={100}
                width={100}
                className="mr-4 h-12 w-12 rounded-full"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  objectFit: "cover"
                }} />
            )}
            <div className="flex flex-col">
              <span className="text-foreground">{lesson.instructor.name}</span>
              {lesson.bookingStatus !== 'closed' && (
                <span className="text-sm font-light text-muted-foreground">
                  {lesson.remainingCapacity} places remaining
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            {lesson.bookingStatus !== 'closed' && (
              <span className="text-sm font-light text-muted-foreground">
                {lesson.remainingCapacity} places remaining
              </span>
            )}
          </>
        )}
      </div>
      <div className="w-full md:w-1/4">
        <CheckInButton
          lessonId={lesson.id}
          type={lesson.classOption.type}
          scheduleState={lesson.scheduleState}
          manageHref={manageHref}
        />
      </div>
    </div>
  );
}


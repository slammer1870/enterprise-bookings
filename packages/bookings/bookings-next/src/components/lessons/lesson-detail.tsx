import React from 'react'

import Image from "next/image"

import { format } from 'date-fns'

import { Lesson } from '@repo/shared-types'

import { CheckInButton } from './checkin-button'

export function LessonDetail({ 
  lesson,
  manageHref,
}: { 
  lesson: Lesson;
  /**
   * Optional function or string to generate the manage booking URL.
   * Passed through to CheckInButton component.
   */
  manageHref?: string | ((lessonId: number) => string);
}) {
  return (
    <div
      className="w-full flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      key={lesson.id}
    >
      <div>
        <div className="text-sm font-light">
          {format(new Date(lesson.startTime), 'HH:mm a')} -{' '}
          {format(new Date(lesson.endTime), 'HH:mm a')}
        </div>
        <div className="text-xl font-medium">
          {lesson.classOption.name}{' '}
          {lesson.location && (
            <>
              - <span className="font-normal">{lesson.location}</span>
            </>
          )}
        </div>
        {lesson.instructor ? (
          <div className="flex items-center justify-start mt-2">
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
              <span>{lesson.instructor.name}</span>
              {lesson.bookingStatus !== 'closed' && (
                <span className="font-light text-sm">
                  {lesson.remainingCapacity} places remaining
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            {lesson.bookingStatus !== 'closed' && (
              <span className="font-light text-sm">
                {lesson.remainingCapacity} places remaining
              </span>
            )}
          </>
        )}
      </div>
      <div className="w-full md:w-1/4">
        <CheckInButton
          bookingStatus={lesson.bookingStatus}
          type={lesson.classOption.type}
          id={lesson.id}
          manageHref={manageHref}
          myBookingCount={lesson.myBookingCount}
        />
      </div>
    </div>
  );
}


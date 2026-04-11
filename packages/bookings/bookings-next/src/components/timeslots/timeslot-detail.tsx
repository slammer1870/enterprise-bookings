import React from 'react'

import Image from "next/image"

import { ScheduleTimeslot } from '@repo/shared-types'
import { formatInTimeZone, resolveTimeslotTimeZone } from '@repo/shared-utils/timezone'

import { CheckInButton } from './checkin-button'

export function TimeslotDetail({ 
  timeslot,
  manageHref,
}: { 
  timeslot: ScheduleTimeslot;
  /**
   * Optional function or string to generate the manage booking URL.
   * Defaults to `/bookings/[id]/manage` if not provided.
   * Passed through to CheckInButton component.
   */
  manageHref?: string | ((timeslotId: number) => string);
}) {
  const timeZone = resolveTimeslotTimeZone(timeslot)

  return (
    <div
      className="flex w-full flex-col gap-4 border-b border-border pb-4 last:border-b-0 last:pb-0 md:flex-row md:items-center md:justify-between"
      key={timeslot.id}
    >
      <div>
        <div className="text-sm font-light text-muted-foreground">
          {formatInTimeZone(timeslot.startTime, 'HH:mm a', timeZone)} -{' '}
          {formatInTimeZone(timeslot.endTime, 'HH:mm a', timeZone)}
        </div>
        <div className="text-xl font-medium text-foreground">
          {timeslot.eventType.name}{' '}
          {timeslot.location && (
            <>
              - <span className="font-normal text-muted-foreground">{timeslot.location}</span>
            </>
          )}
        </div>
        {timeslot.staffMember ? (
          <div className="mt-2 flex items-center justify-start">
            {timeslot.staffMember.profileImage && (
              <Image
                src={(timeslot.staffMember.profileImage.url as string) || ''}
                alt={timeslot.eventType.name}
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
              <span className="text-foreground">{timeslot.staffMember.name}</span>
              {timeslot.bookingStatus !== 'closed' && (
                <span className="text-sm font-light text-muted-foreground">
                  {timeslot.remainingCapacity} places remaining
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            {timeslot.bookingStatus !== 'closed' && (
              <span className="text-sm font-light text-muted-foreground">
                {timeslot.remainingCapacity} places remaining
              </span>
            )}
          </>
        )}
      </div>
      <div className="w-full md:w-1/4">
        <CheckInButton
          timeslotId={timeslot.id}
          type={timeslot.eventType.type}
          scheduleState={timeslot.scheduleState}
          manageHref={manageHref}
        />
      </div>
    </div>
  );
}


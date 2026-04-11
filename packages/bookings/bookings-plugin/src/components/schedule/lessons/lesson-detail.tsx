import React from "react";

import Image from "next/image";

import { Timeslot } from "@repo/shared-types";
import { formatInTimeZone, resolveTimeslotTimeZone } from "@repo/shared-utils/timezone";

import CheckInButton from "./checkin-button";

export function TimeslotDetail({ timeslot }: { timeslot: Timeslot }) {
  const timeZone = resolveTimeslotTimeZone(timeslot);

  return (
    <div
      className="w-full flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      key={timeslot.id}
    >
      <div>
        <div className="text-sm font-light">
          {formatInTimeZone(timeslot.startTime, "HH:mm a", timeZone)} -{" "}
          {formatInTimeZone(timeslot.endTime, "HH:mm a", timeZone)}
        </div>
        <div className="text-xl font-medium">
          {timeslot.eventType.name}{" "}
          {timeslot.location && (
            <>
              - <span className="font-normal">{timeslot.location}</span>
            </>
          )}
        </div>
        {timeslot.staffMember ? (
          <div className="flex items-center justify-start mt-2">
            {timeslot.staffMember.profileImage && (
              <Image
                src={(timeslot.staffMember.profileImage.url as string) || ""}
                alt={timeslot.eventType.name}
                height={100}
                width={100}
                objectFit="cover"
                className="mr-4 h-12 w-12 rounded-full"
              />
            )}
            <div className="flex flex-col">
              <span>{timeslot.staffMember.name}</span>
              {timeslot.bookingStatus !== "closed" && (
                <span className="font-light text-sm">
                  {timeslot.remainingCapacity} places remaining
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            {timeslot.bookingStatus !== "closed" && (
              <span className="font-light text-sm">
                {timeslot.remainingCapacity} places remaining
              </span>
            )}
          </>
        )}
      </div>
      <div className="w-full md:w-1/4">
        <CheckInButton timeslot={timeslot} />
      </div>
    </div>
  );
}

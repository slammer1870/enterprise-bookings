"use client";

import { CalendarIcon, Clock, ClipboardCheck } from "lucide-react";

import type { Timeslot } from "@repo/shared-types";
import {
  formatDateInTimeZone,
  formatInTimeZone,
  resolveTimeslotTimeZone,
} from "@repo/shared-utils/timezone";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

export function BookingSummary({ timeslot }: { timeslot: Timeslot }) {
  const timeZone = resolveTimeslotTimeZone(timeslot);

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Booking Summary</CardTitle>
        <CardDescription>Review your booking summary details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Date:</span>
            <span className="ml-2">
              {formatDateInTimeZone(timeslot.date, "en-US", timeZone, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Time:</span>
            <span className="ml-2">
              {formatInTimeZone(timeslot.startTime, "HH:mmaa", timeZone)} -{" "}
              {formatInTimeZone(timeslot.endTime, "HH:mmaa", timeZone)}
            </span>
          </div>

          <div className="flex items-center">
            <ClipboardCheck className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Booking Type:</span>
            <span className="ml-2">{timeslot.eventType.name}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

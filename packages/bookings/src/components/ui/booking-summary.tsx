"use client";

import { CalendarIcon, Clock, ClipboardCheck, Users } from "lucide-react";
import { format } from "date-fns";
import { BookingDetails } from "@repo/shared-types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

interface BookingSummaryProps {
  bookingDetails: BookingDetails;
  attendeesCount: number;
}

export function BookingSummary({
  bookingDetails,
  attendeesCount,
}: BookingSummaryProps) {
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
              {format(bookingDetails.date, "EEEE, MMMM d, yyyy")}
            </span>
          </div>

          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Time:</span>
            <span className="ml-2">
              {format(bookingDetails.startTime, "HH:mmaa")} -{" "}
              {format(bookingDetails.endTime, "HH:mmaa")}
            </span>
          </div>

          <div className="flex items-center">
            <Users className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Guests:</span>
            <span className="ml-2">
              {attendeesCount} {attendeesCount === 1 ? "person" : "people"}
            </span>
          </div>

          <div className="flex items-center">
            <ClipboardCheck className="h-5 w-5 mr-2 text-primary" />
            <span className="font-medium">Booking Type:</span>
            <span className="ml-2">{bookingDetails.bookingType}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

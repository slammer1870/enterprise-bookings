"use client";

import { useTRPC } from "@repo/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { BookingSummary } from "../booking-summary";
import { ChildrensBookingForm, ManageCurrentBookings } from "@repo/children";

import { ChildrenPaymentGateway } from "./payments/children-payment-gateway";

/**
 * Standard children booking page methodology (based on bru-grappling):
 * - fetch lesson via tRPC
 * - show summary + current bookings
 * - if payment methods exist: show payment gateway
 * - else: show booking form directly
 */
export function ChildrensBooking() {
  const params = useParams();
  const idParam = params?.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  if (!id) return null;

  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.lessons.getByIdForChildren.queryOptions({ id: parseInt(id, 10) })
  );

  const hasPaymentMethods = Boolean(
    data?.classOption.paymentMethods?.allowedDropIn ||
      data?.classOption.paymentMethods?.allowedPlans?.length
  );

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pt-24 px-4">
      <BookingSummary lesson={data} />
      <ManageCurrentBookings lessonId={data.id} />

      {hasPaymentMethods ? (
        <ChildrenPaymentGateway
          paymentMethods={data.classOption.paymentMethods}
          lessonDate={new Date(data.date)}
          lessonId={data.id}
          bookingStatus={data.bookingStatus}
          remainingCapacity={data.remainingCapacity}
        />
      ) : (
        <ChildrensBookingForm lessonId={data.id} />
      )}
    </div>
  );
}



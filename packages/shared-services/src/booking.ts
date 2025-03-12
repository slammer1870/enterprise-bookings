"use server";

import { getOrCreateUser } from "./user";

type CreateCashBookingProps = {
  lessonId: number;
  userId: number;
  attendees: { name: string; email: string }[];
  totalPrice: number;
  paymentMethod: string;
};

export const createCashBooking = async (
  props: CreateCashBookingProps
): Promise<{ success: boolean; error?: string }> => {
  const { lessonId, attendees, totalPrice, paymentMethod, userId } = props;

  try {
    const request = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/lessons/${lessonId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const lesson = await request.json();

    if (!lesson) {
      throw new Error("Lesson not found");
    }

    if (
      lesson.bookingStatus === "closed" ||
      lesson.bookingStatus === "waitlist" ||
      lesson.bookingStatus === "booked"
    ) {
      throw new Error("Lesson is not active");
    }

    if (attendees.length > lesson.remainingCapacity) {
      throw new Error("Not enough places available");
    }

    const transactionRequest = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/transactions`,
      {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          amount: totalPrice,
          paymentMethod: paymentMethod,
          status: "pending",
          createdBy: userId,
        }),
      }
    );

    const transaction = await transactionRequest.json();

    const bookings = await Promise.all(
      attendees.map(async (attendee) => {
        const user = await getOrCreateUser({
          name: attendee.name,
          email: attendee.email,
        });

        const bookingRequest = await fetch(
          `${process.env.NEXT_PUBLIC_SERVER_URL}/api/bookings`,
          {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
              lesson: lessonId,
              user: user.id,
              status: "confirmed",
              transaction: transaction.id,
            }),
          }
        );

        return await bookingRequest.json();
      })
    );

    return { success: true };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

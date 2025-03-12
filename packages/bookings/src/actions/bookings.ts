"use server";

import { cookies } from "next/headers";

import { getBookingsQuery, getActiveBookingsQuery } from "@repo/shared-utils";

/**
 * Server action to handle user check-in for a lesson
 */
export async function checkInAction(lessonId: number, userId: number) {
  const cookieStore = await cookies();
  const token = cookieStore.get("payload-token")?.value;
  try {
    const query = getBookingsQuery(userId, lessonId);

    // Check if booking exists
    const booking = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/bookings${query}`,
      {
        method: "GET",
        headers: {
          Authorization: `JWT ${token}`,
        },
      }
    );

    const bookingData = await booking.json();

    if (bookingData.totalDocs > 0) {
      // Update existing booking
      const updatedBooking = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/bookings${query}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "confirmed",
          }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `JWT ${token}`,
          },
        }
      );

      if (!updatedBooking.ok) {
        const data = await updatedBooking.json();
        return {
          success: false,
          error: data.errors[0].message || "An error occurred",
        };
      }
    } else {
      // Create new booking
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/bookings`,
        {
          method: "POST",
          body: JSON.stringify({
            lesson: lessonId,
            user: userId,
            status: "confirmed",
          }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `JWT ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: data.errors[0].message || "An error occurred",
        };
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error checking in:", error);
    return {
      success: false,
      error: "Failed to check in",
    };
  }
}

/**
 * Server action to handle cancellation of a booking
 */
export async function cancelBookingAction(lessonId: number, userId: number) {
  const cookieStore = await cookies();
  const token = cookieStore.get("payload-token")?.value;
  try {
    const query = getActiveBookingsQuery(userId, lessonId);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/bookings${query}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "cancelled",
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.errors?.[0]?.message || "An error occurred",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return {
      success: false,
      error: "Failed to cancel booking",
    };
  }
}

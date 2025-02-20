import {
  getActiveBookingsQuery,
  getBookingsQuery,
  getLessonsQuery,
} from "@repo/shared-utils";
import React, { createContext, useContext, useState, useEffect } from "react";

import { Lesson } from "../types";
import { toast } from "sonner";

import { useConfirm } from "@repo/ui/components/ui/use-confirm";

import { useRouter } from "next/navigation";

type ScheduleContextType = {
  lessons: Lesson[];
  isLoading: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  checkIn: (lessonId: number, userId: number) => Promise<void>;
  cancelBooking: (lessonId: number, userId: number) => Promise<void>;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(
  undefined
);

export const ScheduleProvider: React.FC<{
  children: React.ReactNode;
  initialDate?: Date;
}> = ({ children }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  const [ConfirmationDialog, confirm] = useConfirm(
    "Are you sure you want to cancel your booking?",
    "This action cannot be undone"
  );

  const getLessons = async () => {
    const query = getLessonsQuery(selectedDate);

    const data = await fetch(`/api/lessons${query}`, {
      method: "GET",
    });

    const lessons = await data.json();

    return lessons.docs;
  };

  useEffect(() => {
    const fetchLessons = async () => {
      setIsLoading(true);

      const lessons = await getLessons();

      setLessons(lessons);
      setIsLoading(false);
    };

    fetchLessons();
  }, [selectedDate]);

  const checkIn = async (lessonId: number, userId: number) => {
    const query = getBookingsQuery(userId, lessonId);
    try {
      const booking = await fetch(`/api/bookings${query}`, {
        method: "GET",
        credentials: "include",
      });

      const bookingData = await booking.json();

      console.log(bookingData);

      if (bookingData.docs.length > 0) {
        const updatedBooking = await fetch(`/api/bookings${query}`, {
          method: "PATCH",
          credentials: "include",
          body: JSON.stringify({
            status: "confirmed",
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!updatedBooking.ok) {
          const data = await updatedBooking.json();

          toast.error(data.errors[0].message || "An error occurred");
          return router.push(`/bookings/${lessonId}`);
        }
      } else {
        const response = await fetch(`/api/bookings`, {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            lesson: lessonId,
            user: userId,
            status: "confirmed",
          }),
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const data = await response.json();

          toast.error(data.errors[0].message || "An error occurred");
          return router.push(`/bookings/${lessonId}`);
        }
      }
      const updatedLessons = await getLessons();

      setLessons(updatedLessons);

      toast.success("Booking confirmed");
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
    }
  };

  const cancelBooking = async (lessonId: number, userId: number) => {
    const query = getActiveBookingsQuery(userId, lessonId);

    try {
      const response = await fetch(`/api/bookings${query}`, {
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({
          status: "cancelled",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.errors[0].message || "An error occurred");
        throw new Error(data.errors[0].message || "An error occurred");
      }

      const updatedLessons = await getLessons();

      setLessons(updatedLessons);

      toast.success("Booking cancelled");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking");
    }
  };

  return (
    <ScheduleContext.Provider
      value={{
        lessons,
        isLoading,
        selectedDate,
        setSelectedDate,
        checkIn,
        cancelBooking,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

export const useSchedule = () => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error("useSchedule must be used within a ScheduleProvider");
  }

  return context;
};

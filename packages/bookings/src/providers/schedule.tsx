import React, { createContext, useContext, useState, useEffect } from "react";

import { Lesson } from "@repo/shared-types";

import { toast } from "sonner";

import { useRouter } from "next/navigation";

import {
  checkInAction,
  cancelBookingAction,
  joinWaitlistAction,
} from "../actions/bookings";

import { getLessons } from "../actions/lessons";

type ScheduleContextType = {
  lessons: Lesson[];
  isLoading: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  checkIn: (lessonId: number, userId: number) => Promise<void>;
  cancelBooking: (lessonId: number, userId: number) => Promise<void>;
  joinWaitlist: (lessonId: number, userId: number) => Promise<void>;
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

  useEffect(() => {
    const fetchLessons = async () => {
      setIsLoading(true);

      const lessons = await getLessons(selectedDate);

      setLessons(lessons);
      setIsLoading(false);
    };

    fetchLessons();
  }, [selectedDate]);

  const checkIn = async (lessonId: number, userId: number) => {
    try {
      const result = await checkInAction(lessonId, userId);

      if (!result.success) {
        //toast.error(result.error);
        return router.push(`/bookings/${lessonId}`);
      }

      const updatedLessons = await getLessons(selectedDate);
      setLessons(updatedLessons);

      toast.success("Booking confirmed");
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
    }
  };

  const cancelBooking = async (lessonId: number, userId: number) => {
    try {
      const result = await cancelBookingAction(lessonId, userId);

      if (!result.success) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      // Add a small delay to allow background operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const updatedLessons = await getLessons(selectedDate);
      setLessons(updatedLessons);

      toast.success("Booking cancelled");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking");
    }
  };

  const joinWaitlist = async (lessonId: number, userId: number) => {
    try {
      const result = await joinWaitlistAction(lessonId, userId);
      if (!result.success) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      // Add a small delay to allow background operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const updatedLessons = await getLessons(selectedDate);
      setLessons(updatedLessons);

      toast.success("You have been added to the waitlist");
    } catch (error) {
      console.error("Error joining waitlist:", error);
      toast.error("Failed to join waitlist");
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
        joinWaitlist,
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

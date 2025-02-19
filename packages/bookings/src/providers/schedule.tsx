import { getLessonsQuery } from "@repo/shared-utils";
import React, { createContext, useContext, useState, useEffect } from "react";

import { Lesson } from "../types";
import { toast } from "sonner";

import { useRouter } from "next/navigation";

type ScheduleContextType = {
  lessons: Lesson[];
  isLoading: boolean;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  checkIn: (lessonId: number, userId: string) => void;
  cancelBooking: (lessonId: number) => void;
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

  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

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

  const checkIn = async (lessonId: number, userId: string) => {
    try {
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
        router.push("/bookings");
      }

      const updatedLessons = await getLessons();

      setLessons(updatedLessons);

      toast.success("Booking confirmed");
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
    }
  };

  const cancelBooking = (lessonId: number) => {
    setLessons((prevLessons) =>
      prevLessons.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, bookingStatus: "active" } : lesson
      )
    );
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

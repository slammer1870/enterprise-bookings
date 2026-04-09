import React, { createContext, useContext, useState, useEffect } from "react";

import { Timeslot } from "@repo/shared-types";

import { toast } from "sonner";

import { useRouter } from "next/navigation";

import {
  checkInAction,
  cancelBookingAction,
  joinWaitlistAction,
} from "../actions/bookings";

import { getTimeslots } from "../actions/timeslots";

type ScheduleContextType = {
  timeslots: Timeslot[];
  isLoading: boolean;
  error: string | null;
  selectedDate: Date;
  setSelectedDate: (_date: Date) => void;
  checkIn: (_timeslotId: number, _userId: number) => Promise<void>;
  cancelBooking: (_timeslotId: number, _userId: number) => Promise<void>;
  joinWaitlist: (_timeslotId: number, _userId: number) => Promise<void>;
};

const ScheduleContext = createContext<ScheduleContextType | undefined>(
  undefined
);

export const ScheduleProvider: React.FC<{
  children: React.ReactNode;
  initialDate?: Date;
}> = ({ children }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeslots, setTimeslots] = useState<Timeslot[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const fetchTimeslots = async () => {
      setIsLoading(true);

      try {
        const timeslots = await getTimeslots(selectedDate);
        setTimeslots(timeslots);
      } catch (error) {
        setError(error as string);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimeslots();
  }, [selectedDate]);

  const checkIn = async (timeslotId: number, userId: number) => {
    try {
      const result = await checkInAction(timeslotId, userId);

      if (!result.success) {
        //toast.error(result.error);
        return router.push(`/bookings/${timeslotId}`);
      }

      const updatedTimeslots = await getTimeslots(selectedDate);
      setTimeslots(updatedTimeslots);

      toast.success("Booking confirmed");
    } catch (error) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
    }
  };

  const cancelBooking = async (timeslotId: number, userId: number) => {
    try {
      const result = await cancelBookingAction(timeslotId, userId);

      if (!result.success) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      // Add a small delay to allow background operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const updatedTimeslots = await getTimeslots(selectedDate);
      setTimeslots(updatedTimeslots);

      toast.success("Booking cancelled");
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking");
    }
  };

  const joinWaitlist = async (timeslotId: number, userId: number) => {
    try {
      const result = await joinWaitlistAction(timeslotId, userId);
      if (!result.success) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      // Add a small delay to allow background operations to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const updatedTimeslots = await getTimeslots(selectedDate);
      setTimeslots(updatedTimeslots);

      toast.success("You have been added to the waitlist");
    } catch (error) {
      console.error("Error joining waitlist:", error);
      toast.error("Failed to join waitlist");
    }
  };

  return (
    <ScheduleContext.Provider
      value={{
        timeslots,
        isLoading,
        error,
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

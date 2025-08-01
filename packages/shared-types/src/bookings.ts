import { User } from "./user";

import { DropIn, Plan, Transaction } from "./payments";

export type Lesson = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  classOption: ClassOption;
  location: string;
  instructor: User;
  bookings: { docs: Booking[] };
  remainingCapacity: number;
  bookingStatus:
    | "active"
    | "waitlist"
    | "waiting"
    | "closed"
    | "booked"
    | "trialable"
    | "childrenBooked";
  originalLockOutTime?: number;
};

export interface Booking {
  id: number;
  user: User;
  lesson: Lesson;
  status: "pending" | "confirmed" | "cancelled" | "waiting";
  updatedAt: string;
  createdAt: string;
  transaction?: Transaction;
}

export interface ClassOption {
  id: number;
  name: string;
  places: number;
  description: string;
  type?: "adult" | "child";
  paymentMethods?: {
    allowedDropIn?: DropIn;
    allowedPlans?: Plan[];
  };
}

export type Attendee = {
  id: string;
  name: string;
  email: string;
};

export type BookingDetails = {
  date: string;
  startTime: string;
  endTime: string;
  bookingType: string;
};

export type BookingFormData = {
  lessonId: number;
  attendees: Attendee[];
  paymentMethod: string;
  totalPrice: number;
};

import { User } from "./user";

import { DropIn, Plan, Transaction } from "./payments";

export type Instructor = {
  id: number;
  name?: string | null;
  profileImage?: {
    url: string;
  } | null;
  user?: number | User;
  active?: boolean | null;
};

export type Lesson = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  classOption: ClassOption;
  location: string;
  instructor?: Instructor | null;
  bookings: { docs: Booking[] };
  remainingCapacity: number;
  bookingStatus:
    | "active"
    | "waitlist"
    | "waiting"
    | "closed"
    | "booked"
    | "trialable"
    | "childrenBooked"
    | "multipleBooked";
  originalLockOutTime?: number;
  /** Present in multi-tenant apps; ID or populated { id }. */
  tenant?: number | { id: number } | null;
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

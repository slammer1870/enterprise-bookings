import { User } from "./user";

import { DropIn, Plan } from "./payments";

export type Lesson = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  classOption: ClassOption;
  location: string;
  user: User;
  bookings: { docs: Booking[] };
  remainingCapacity: number;
  bookingStatus: "active" | "waitlist" | "closed" | "booked" | "trialable";
};

export interface Booking {
  id: number;
  user: User;
  lesson: Lesson;
  status: "pending" | "confirmed" | "cancelled" | "waiting";
  updatedAt: string;
  createdAt: string;
}

export interface ClassOption {
  id: number;
  name: string;
  places: number;
  description: string;
  type: "adult" | "child";
  paymentMethods?: {
    allowedDropIns?: DropIn;
    allowedPlans?: Plan[];
  };
}

import { User } from "./user";

import { DropIn, Plan } from "./payments";

export interface Lesson {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  lockOutTime: number;
  location: string;
  available: boolean;
  trialable: boolean;
  complimentary: boolean;
  classOption: ClassOption;
  instructor: number | User;
  remainingCapacity?: number | null;
  bookings?: {
    docs?: (number | Booking)[] | null;
    hasNextPage?: boolean | null;
  } | null;
  bookingStatus?: string | null;
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "class-options".
 */
export interface ClassOption {
  id: number;
  name: string;
  places: number;
  description: string;
  type: "adult" | "child";
  paymentMethods?: {
    allowedDropIns?: (number | DropIn)[] | null;
    allowedPlans?: (number | Plan)[] | null;
  };
  updatedAt: string;
  createdAt: string;
}

export interface Booking {
  id: number;
  user: User;
  lesson: Lesson;
  status: "pending" | "confirmed" | "cancelled" | "waiting";
  updatedAt: string;
  createdAt: string;
}

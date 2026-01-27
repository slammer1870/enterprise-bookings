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
  /**
   * Per-viewer booking status (legacy).
   *
   * NOTE: This is computed via a Payload `afterRead` hook and can be expensive / inconsistent
   * across different query paths (tenant context, overrideAccess). New schedule UI should prefer
   * `scheduleState` which is computed in tRPC in a single batch.
   */
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
  /**
   * Schedule-specific view model computed server-side (tRPC).
   * When present, UI should render buttons from this instead of `bookingStatus`.
   */
  scheduleState?: LessonScheduleState;
  /**
   * Optional: Number of confirmed bookings the current user has for this lesson.
   * Provided by lessons.getByDate to avoid N+1 queries in CheckInButton.
   * If not provided, CheckInButton will fetch it separately (backwards compatible).
   */
  myBookingCount?: number;
};

export type LessonAvailability = "open" | "full" | "closed";

export type LessonViewerAction =
  | "book"
  | "cancel"
  | "modify"
  | "joinWaitlist"
  | "leaveWaitlist"
  | "closed"
  | "loginToBook"
  | "manageChildren";

export type LessonScheduleState = {
  availability: LessonAvailability;
  viewer: {
    confirmedIds: number[];
    confirmedCount: number;
    waitingIds: number[];
    waitingCount: number;
  };
  /**
   * UI intent for the primary CTA.
   * The client should treat this as authoritative for schedule buttons.
   */
  action: LessonViewerAction;
  /**
   * Optional server-precomputed label for the CTA.
   * When omitted, the client may derive a label from `action`.
   */
  label?: string;
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

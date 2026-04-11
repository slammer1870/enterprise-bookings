import { User } from "./user";

import { DropIn, Plan, Transaction } from "./payments";

export type StaffMember = {
  id: number;
  name?: string | null;
  profileImage?: {
    url: string;
  } | null;
  user?: number | User;
  active?: boolean | null;
};

/**
 * Minimal timeslot DTO for schedule/homepage views.
 *
 * Security note: This intentionally excludes payment provider fields, tenant objects,
 * and relationship docs that shouldn't be exposed to the client.
 */
export type ScheduleStaffMember = {
  id: number;
  name?: string | null;
  profileImage?: { url: string } | null;
};

export type ScheduleEventType = {
  id: number;
  name: string;
  type?: "adult" | "child";
};

export type ScheduleTimeslot = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  eventType: ScheduleEventType;
  location: string;
  staffMember?: ScheduleStaffMember | null;
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
  /** Tenant ID only (never a full tenant object). */
  tenant?: number | null;
  /** Resolved timezone for formatting/query consumers. */
  timeZone?: string;
  /** Schedule-specific view model computed server-side (tRPC). */
  scheduleState?: TimeslotScheduleState;
  /** Optional: confirmed booking count for the viewer. */
  myBookingCount?: number;
};

export type Timeslot = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  eventType: EventType;
  location: string;
  staffMember?: StaffMember | null;
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
  /** Present in multi-tenant apps; ID or populated tenant info. */
  tenant?: number | { id: number; slug?: string; timeZone?: string | null } | null;
  /** Resolved timezone for formatting/query consumers. */
  timeZone?: string;
  /**
   * Schedule-specific view model computed server-side (tRPC).
   * When present, UI should render buttons from this instead of `bookingStatus`.
   */
  scheduleState?: TimeslotScheduleState;
  /**
   * Optional: Number of confirmed bookings the current user has for this timeslot.
   * Provided by timeslots.getByDate to avoid N+1 queries in CheckInButton.
   * If not provided, CheckInButton will fetch it separately (backwards compatible).
   */
  myBookingCount?: number;
};

export type TimeslotAvailability = "open" | "full" | "closed";

export type TimeslotViewerAction =
  | "book"
  | "cancel"
  | "modify"
  | "joinWaitlist"
  | "leaveWaitlist"
  | "closed"
  | "loginToBook"
  | "manageChildren";

export type TimeslotScheduleState = {
  availability: TimeslotAvailability;
  viewer: {
    confirmedIds: number[];
    confirmedCount: number;
    waitingIds: number[];
    waitingCount: number;
  };
  /**
   * True when the timeslot's booking/payment configuration effectively limits the viewer
   * to a single booking slot (e.g. membership/drop-in rules disallow multi-booking).
   * When true, schedule UX can attempt direct booking/cancellation without extra navigation.
   */
  singleSlotOnly?: boolean;
  /**
   * UI intent for the primary CTA.
   * The client should treat this as authoritative for schedule buttons.
   */
  action: TimeslotViewerAction;
  /**
   * Optional server-precomputed label for the CTA.
   * When omitted, the client may derive a label from `action`.
   */
  label?: string;
};

export interface Booking {
  id: number;
  user: User;
  timeslot: Timeslot;
  status: "pending" | "confirmed" | "cancelled" | "waiting";
  updatedAt: string;
  createdAt: string;
  transaction?: Transaction;
}

export interface EventType {
  id: number;
  name: string;
  places: number;
  description: string;
  type?: "adult" | "child";
  paymentMethods?: {
    allowedDropIn?: DropIn;
    allowedClassPasses?: ClassPassType[];
    allowedPlans?: Plan[];
  };
}

export interface ClassPassType {
  id: number;
  name?: string | null;
  slug?: string | null;
  quantity?: number | null;
  allowMultipleBookingsPerTimeslot?: boolean;
  status?: "active" | "inactive" | null;
  priceInformation?: {
    price?: number | null;
  } | null;
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
  timeslotId: number;
  attendees: Attendee[];
  paymentMethod: string;
  totalPrice: number;
};

import { EventType } from "./bookings";

import { User } from "./user";

export interface DropIn {
  id: number;
  name: string;
  isActive: boolean;
  price: number;
  priceType: "trial" | "normal";
  /**
   * Per-viewer max confirmed bookings allowed for the same timeslot when paying with this drop-in.
   * - `1` => one booking per timeslot
   * - `null`/`undefined` => no per-viewer limit (still bounded by event type capacity)
   */
  maxBookingsPerTimeslot?: number | null;
  /**
   * When true, each customer may purchase this drop-in product only once.
   */
  oncePerUser?: boolean | null;
  discountTiers?:
    | {
        minQuantity: number;
        maxQuantity: number;
        discountPercent: number;
        type: "trial" | "normal";
      }[]
    | null;
  allowedClasses?: (number | EventType)[] | null;
  updatedAt: string;
  createdAt: string;
}

export interface Plan {
  id: number;
  name: string;
  features?:
    | {
        feature?: string | null;
        id?: string | null;
      }[]
    | null;
  sessionsInformation?: {
    sessions?: number;
    intervalCount?: number;
    interval?: "day" | "week" | "month" | "quarter" | "year";
    /**
     * Per-viewer max confirmed bookings allowed for the same timeslot when paying with this membership.
     * - `1` => one booking per timeslot
     * - `null`/`undefined` => no per-viewer limit (still bounded by event type capacity)
     */
    maxBookingsPerTimeslot?: number | null;
    eventTypeOverrides?:
      | {
          id?: string | null;
          eventType?: number | { id: number } | null;
          sessions?: number | null;
          /**
           * When set with `interval`, this event type is counted in its own window.
           * Blank keeps the plan's sessions interval.
           */
          intervalCount?: number | null;
          interval?: "day" | "week" | "month" | "quarter" | "year" | null;
          /**
           * Replaces `maxBookingsPerTimeslot` for this event type only.
           * Blank keeps the plan cap.
           */
          maxBookingsPerTimeslot?: number | null;
        }[]
      | null;
  } | null;
  allowedEventTypes?: Array<number | { id: number }> | null;
  priceInformation?: {
    price: number;
    intervalCount: number;
    interval: "day" | "week" | "month" | "quarter" | "year";
  } | null;
  stripeProductId?: string | null;
  priceJSON?: string | null;
  footerText?: string | null;
  isSubscribed?: boolean | null;
  status: "active" | "inactive";
  type?: "child" | "adult" | "family";
  quantity?: number | null;
  updatedAt: string;
  createdAt: string;
}

export interface Transaction {
  id: number;
  amount: number;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  paymentMethod: "cash" | "card";
  createdBy: User;
}

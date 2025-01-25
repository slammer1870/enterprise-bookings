export type BookingsPluginConfig = {
  /**
   * Enable or disable plugin
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable or disable payment
   * @default false
   */
  paymentsEnabled?: boolean;

  /**
   * Enable or disable children
   * @default false
   */
  childrenEnabled?: boolean;
};

export type Lesson = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  classOption: ClassOption;
  bookings: { docs: Booking[] };
  remainingCapacity: number;
  bookingStatus: "active" | "waitlist" | "closed" | "booked" | "trialable";
};

export interface Booking {
  id: number;
  user: User;
  lesson: number | Lesson;
  status: "pending" | "confirmed" | "cancelled" | "waiting";
  updatedAt: string;
  createdAt: string;
}

export interface User {
  id: number;
  name?: string;
  email: string;
  roles?: string[];
}

export interface ClassOption {
  id: number;
  name: string;
  places: number;
  description: string;
  type: "adult" | "child";
  paymentMethods?: {
    allowedDropIns?: DropIn[];
    allowedPlans?: Plan[];
  };
  updatedAt: string;
  createdAt: string;
}
/**
 * This interface was referenced by `Config`'s JSON-Schema
 * via the `definition` "drop-ins".
 */
export interface DropIn {
  id: number;
  name: string;
  price: number;
  priceType: "trial" | "normal";
  allowedClasses?: {
    docs?: (number | ClassOption)[] | null;
    hasNextPage?: boolean | null;
  } | null;
  active?: boolean | null;
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
  sessions?: number | null;
  intervalCount?: number | null;
  interval?: ("day" | "week" | "month" | "quarter" | "year") | null;
  stripeProductID?: string | null;
  priceJSON?: string | null;
  isSubscribed?: boolean | null;
  updatedAt: string;
  createdAt: string;
}

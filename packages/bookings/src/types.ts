export type PluginTypes = {
  /**
   * Enable or disable plugin
   * @default false
   */
  enabled: boolean;

  /**
   * Add payment methods
   */
  paymentMethods: {
    stripeSecretKey?: string;
    allowedDropIns?: boolean;
    allowedPlans?: boolean;
    allowedPasses?: boolean;
  };

  /**
   * Enable or disable children
   * @default false
   */
  childrenEnabled?: boolean;
};

export type Lesson = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  class_option: number | ClassOption;
  bookings: { docs: Booking[] };
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
  name: string;
  email: string;
}

export interface ClassOption {
  id: number;
  name: string;
  places: number;
  description: string;
  type: "adult" | "child";
  paymentMethods?: {
    allowedDropIns?: DropIn[] | undefined;
    allowedPlans?: Plan[] | undefined;
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
  price_type: "trial" | "normal";
  allowed_classes?: {
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
  interval_count?: number | null;
  interval?: ("day" | "week" | "month" | "quarter" | "year") | null;
  stripeProductID?: string | null;
  priceJSON?: string | null;
  isSubscribed?: boolean | null;
  updatedAt: string;
  createdAt: string;
}

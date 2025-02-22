import { ClassOption } from "./bookings";

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
  stripeProductId?: string | null;
  priceJSON?: string | null;
  isSubscribed?: boolean | null;
  updatedAt: string;
  createdAt: string;
}

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

import { ClassOption } from "./bookings";

import { User } from "./user";

export interface DropIn {
  id: number;
  name: string;
  isActive: boolean;
  price: number;
  priceType: "trial" | "normal";
  adjustable?: boolean | null;
  discountTiers?:
    | {
        minQuantity: number;
        maxQuantity: number;
        discountPercent: number;
        type: "trial" | "normal";
      }[]
    | null;
  paymentMethods: string[];
  allowedClasses?: (number | ClassOption)[] | null;
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
    sessions: number;
    intervalCount: number;
    interval: "day" | "week" | "month" | "quarter" | "year";
  } | null;
  priceInformation?: {
    price: number;
    intervalCount: number;
    interval: "day" | "week" | "month" | "quarter" | "year";
  } | null;
  stripeProductId?: string | null;
  priceJSON?: string | null;
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

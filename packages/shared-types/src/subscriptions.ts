import { User } from "./user";
import { Plan } from "./payments";

export interface Subscription {
  id: number;
  user: User;
  plan: Plan;
  status:
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "paused";
  startDate?: string | null;
  endDate?: string | null;
  cancelAt?: string | null;
  quantity?: number;
  stripeSubscriptionId?: string | null;
  updatedAt: string;
  createdAt: string;
}

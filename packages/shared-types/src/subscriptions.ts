import { User } from "./user";
import { Plan } from "./payments";

export interface Subscription {
  id: number;
  user: number | User;
  plan: number | Plan;
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
  stripeSubscriptionId?: string | null;
  updatedAt: string;
  createdAt: string;
}

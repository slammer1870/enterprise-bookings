import { lessonsRouter } from "./routers/lessons";
import { createPaymentsRouter } from "./routers/payments";
import { subscriptionsRouter } from "./routers/subscriptions";
import { usersRouter } from "./routers/users";
import { bookingsRouter } from "./routers/bookings";
import { authRouter } from "./routers/auth";

import {
  createTRPCRouter,
  type GetSubscriptionBookingFeeCents,
} from "./trpc";
import type { GetDropInFeeBreakdown } from "./routers/payments";

export type AppRouterOptions = {
  payments?: {
    getSubscriptionBookingFeeCents?: GetSubscriptionBookingFeeCents;
    getDropInFeeBreakdown?: GetDropInFeeBreakdown;
  };
};

export function createAppRouter(options?: AppRouterOptions) {
  const paymentsRouter = createPaymentsRouter(options?.payments);

  return createTRPCRouter({
    lessons: lessonsRouter,
    bookings: bookingsRouter,
    subscriptions: subscriptionsRouter,
    payments: paymentsRouter,
    users: usersRouter,
    auth: authRouter,
  });
}

/** Default router (no payment options). Used by apps that do not need subscription booking fee. */
export const appRouter = createAppRouter();

export type AppRouter = typeof appRouter;

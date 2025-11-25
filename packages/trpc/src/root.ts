import { lessonsRouter } from "./routers/lessons";
import { paymentsRouter } from "./routers/payments";
import { subscriptionsRouter } from "./routers/subscriptions";
import { usersRouter } from "./routers/users";
import { bookingsRouter } from "./routers/bookings";
import { authRouter } from "./routers/auth";

import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  lessons: lessonsRouter,
  bookings: bookingsRouter,
  subscriptions: subscriptionsRouter,
  payments: paymentsRouter,
  users: usersRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;

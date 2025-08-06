import { lessonsRouter } from "./routers/lessons";
import { paymentsRouter } from "./routers/payments";
import { subscriptionsRouter } from "./routers/subscriptions";
import { usersRouter } from "./routers/users";

import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  lessons: lessonsRouter,
  subscriptions: subscriptionsRouter,
  payments: paymentsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;

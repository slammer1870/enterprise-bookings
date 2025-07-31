import { lessonsRouter } from "./routers/lessons";
import { subscriptionsRouter } from "./routers/subscriptions";

import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  lessons: lessonsRouter,
  subscriptions: subscriptionsRouter,
});

export type AppRouter = typeof appRouter;

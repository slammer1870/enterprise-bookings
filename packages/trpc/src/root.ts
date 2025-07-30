import { lessonsRouter } from "./router/lessons";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  lessons: lessonsRouter,
});

export type AppRouter = typeof appRouter;

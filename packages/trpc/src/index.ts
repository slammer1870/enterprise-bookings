import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter, AppRouterOptions } from "./root";
import { appRouter, createAppRouter } from "./root";
import { createTRPCContext } from "./trpc";

/**
 * Inference helpers for input types
 * @example
 * type PostByIdInput = RouterInputs['post']['byId']
 *      ^? { id: number }
 **/
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type AllPostsOutput = RouterOutputs['post']['all']
 *      ^? Post[]
 **/
type RouterOutputs = inferRouterOutputs<AppRouter>;

// Export server-side utilities
export { createTRPCContext, appRouter, createAppRouter };
export type { AppRouter, AppRouterOptions, RouterInputs, RouterOutputs };
export type { TRPCBookingCollectionSlugs } from "./bookings-slugs";
export { DEFAULT_TRPC_BOOKING_COLLECTION_SLUGS, mergeTRPCBookingCollectionSlugs } from "./bookings-slugs";

// Export client-side utilities
export { TRPCReactProvider, useTRPC } from "./client";
export { createServerTRPC, createServerTRPCContext } from "./server";
export { createQueryClient } from "./query-client";

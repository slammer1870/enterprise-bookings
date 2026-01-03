import { cache } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { createQueryClient } from "./query-client";
import { createTRPCContext } from "./trpc";
import { User } from "@repo/shared-types";

type CreateServerContextOptions = Parameters<typeof createTRPCContext>[0];
type BaseTRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Creates server-side tRPC context
 * Apps should call this with their payload instance
 */
export const createServerTRPCContext = async (
  opts: CreateServerContextOptions
) => {
  return createTRPCContext(opts);
};

/**
 * Factory function to create server-side tRPC utilities for a specific app
 */
export function createServerTRPC(
  createContext: () => Promise<BaseTRPCContext & { user?: User }>
) {
  const getQueryClient = cache(createQueryClient);

  const trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>> =
    createTRPCOptionsProxy<AppRouter>({
      router: appRouter,
      ctx: createContext,
      queryClient: getQueryClient,
    });

  function HydrateClient(props: { children: React.ReactNode }) {
    const queryClient = getQueryClient();
    const dehydratedState = dehydrate(queryClient);

    return (
      <HydrationBoundary state={dehydratedState}>
        {props.children}
      </HydrationBoundary>
    );
  }

  function prefetch<T>(queryOptions: T) {
    const queryClient = getQueryClient();
    const opts = queryOptions as { queryKey?: [unknown, { type?: string }] };
    if (opts?.queryKey?.[1]?.type === "infinite") {
      void queryClient.prefetchInfiniteQuery(queryOptions as Parameters<typeof queryClient.prefetchInfiniteQuery>[0]);
    } else {
      void queryClient.prefetchQuery(queryOptions as Parameters<typeof queryClient.prefetchQuery>[0]);
    }
  }

  return {
    trpc,
    getQueryClient,
    HydrateClient,
    prefetch,
  };
}

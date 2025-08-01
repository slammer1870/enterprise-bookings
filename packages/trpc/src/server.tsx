import type { TRPCQueryOptions } from '@trpc/tanstack-react-query'
import { cache } from 'react'
import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'

import type { AppRouter } from './root'
import { appRouter } from './root'
import { createQueryClient } from './query-client'

interface CreateServerContextOptions {
  payload: any // Replace with proper Payload type
  headers?: Headers
}

/**
 * Creates server-side tRPC context
 * Apps should call this with their payload instance
 */
export const createServerTRPCContext = (opts: CreateServerContextOptions) => {
  return {
    headers: opts.headers || new Headers(),
    payload: opts.payload,
  }
}

/**
 * Factory function to create server-side tRPC utilities for a specific app
 */
export function createServerTRPC(createContext: () => Promise<any>) {
  const getQueryClient = cache(createQueryClient)

  const trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>> =
    createTRPCOptionsProxy<AppRouter>({
      router: appRouter,
      ctx: createContext,
      queryClient: getQueryClient,
    })

  function HydrateClient(props: { children: React.ReactNode }) {
    const queryClient = getQueryClient()
    const dehydratedState = dehydrate(queryClient)

    return (
      <HydrationBoundary state={dehydratedState}>
        {props.children}
      </HydrationBoundary>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function prefetch<T extends ReturnType<any>>(queryOptions: T) {
    const queryClient = getQueryClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if ((queryOptions as any)?.queryKey?.[1]?.type === 'infinite') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      void queryClient.prefetchInfiniteQuery(queryOptions as any)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      void queryClient.prefetchQuery(queryOptions as any)
    }
  }

  return {
    trpc,
    getQueryClient,
    HydrateClient,
    prefetch,
  }
} 
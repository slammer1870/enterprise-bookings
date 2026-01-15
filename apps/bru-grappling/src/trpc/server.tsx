import { cache } from 'react'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

import { createServerTRPC, createServerTRPCContext } from '@repo/trpc/server'
import { appRouter, createTRPCContext } from '@repo/trpc'

import { stripe } from '../lib/stripe'

const createContext = cache(async () => {
  const heads = new Headers(await nextHeaders())
  heads.set('x-trpc-source', 'rsc')

  const payload = await getPayload({ config })

  return createServerTRPCContext({
    headers: heads,
    payload: payload,
    stripe: stripe,
  })
})

type ServerTRPC = ReturnType<typeof createServerTRPC>
const serverTRPC: ServerTRPC = createServerTRPC(createContext)

export const trpc: ServerTRPC['trpc'] = serverTRPC.trpc
export const getQueryClient: ServerTRPC['getQueryClient'] = serverTRPC.getQueryClient
export const HydrateClient: ServerTRPC['HydrateClient'] = serverTRPC.HydrateClient
export const prefetch: ServerTRPC['prefetch'] = serverTRPC.prefetch

/**
 * Creates a tRPC caller for use in server components and server actions.
 * This provides a convenient way to call tRPC procedures directly from server-side code.
 * 
 * @example
 * ```ts
 * const caller = await createCaller()
 * const result = await caller.bookings.validateAndAttemptCheckIn({ lessonId: 123 })
 * ```
 */
export async function createCaller(): Promise<ReturnType<typeof appRouter.createCaller>> {
  const heads = await nextHeaders()
  const headers = new Headers(heads)
  headers.set('x-trpc-source', 'rsc')

  const payload = await getPayload({ config })

  const ctx = await createTRPCContext({
    headers,
    payload,
    stripe,
  })

  return appRouter.createCaller(ctx)
}

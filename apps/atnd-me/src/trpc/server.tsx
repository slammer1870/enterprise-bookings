import { cache } from 'react'
import { headers as nextHeaders } from 'next/headers'

import { createServerTRPC, createServerTRPCContext } from '@repo/trpc/server'
import { createTRPCContext } from '@repo/trpc'

import { appRouter } from '@/trpc/router'
import { getPayload } from '@/lib/payload'
import { stripe } from '../lib/stripe'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

const createContext = cache(async () => {
  const heads = new Headers(await nextHeaders())
  heads.set('x-trpc-source', 'rsc')
  const host = heads.get('host') || heads.get('x-forwarded-host') || ''
  if (host && !heads.get('host')) {
    heads.set('host', host)
  }

  const payload = await getPayload()

  return createServerTRPCContext({
    headers: heads,
    payload: payload,
    stripe: stripe,
    bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
  })
})

type ServerTRPC = ReturnType<typeof createServerTRPC>
const serverTRPC: ServerTRPC = createServerTRPC(createContext, appRouter)

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
 * const result = await caller.bookings.validateAndAttemptCheckIn({ timeslotId: 123 })
 * ```
 */
export async function createCaller(opts?: {
  host?: string
}): Promise<ReturnType<typeof appRouter.createCaller>> {
  const heads = await nextHeaders()
  const headers = new Headers(heads)
  headers.set('x-trpc-source', 'rsc')
  const host =
    opts?.host ?? headers.get('host') ?? headers.get('x-forwarded-host') ?? ''
  if (host && !headers.get('host')) {
    headers.set('host', host)
  }

  const payload = await getPayload()

  const ctx = await createTRPCContext({
    headers,
    payload,
    stripe,
    hostOverride: opts?.host || host || undefined,
    bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
  })

  return appRouter.createCaller(ctx)
}

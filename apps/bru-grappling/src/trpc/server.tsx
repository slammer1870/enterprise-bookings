import { cache } from 'react'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

import { createServerTRPC, createServerTRPCContext } from '@repo/trpc/server'

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

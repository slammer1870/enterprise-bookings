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

export const { trpc, getQueryClient, HydrateClient, prefetch } = createServerTRPC(createContext)

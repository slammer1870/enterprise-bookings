import { cache } from 'react'
import { headers as nextHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

import { createServerTRPC, createServerTRPCContext } from '@repo/trpc/server'

const createContext = cache(async () => {
  const heads = new Headers(await nextHeaders())
  heads.set('x-trpc-source', 'rsc')

  const payload = await getPayload({ config })

  // Try to get session from better-auth
  let session = null
  if ((payload as any).betterAuth) {
    try {
      const sessionResult = await (payload as any).betterAuth.api.getSession({
        headers: heads,
      })
      session = sessionResult?.data?.session || null
    } catch (error) {
      console.warn('Better-auth session fetch failed:', error)
    }
  }

  return createServerTRPCContext({
    headers: heads,
    payload: payload,
    stripe: undefined,
    session: session,
  })
})

export const { trpc, getQueryClient, HydrateClient, prefetch } = createServerTRPC(createContext)


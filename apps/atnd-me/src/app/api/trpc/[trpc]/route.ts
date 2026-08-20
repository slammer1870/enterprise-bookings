import type { NextRequest } from 'next/server'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

import { createTRPCContext } from '@repo/trpc'

import { appRouter } from '@/trpc/router'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { resolveRegistrationTenantIdForRequest } from '@/trpc/resolveRegistrationTenantId'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * tRPC is a cookie-authenticated application API. Only exact origins
 * explicitly configured for cross-origin use may receive CORS headers.
 */
const configuredCorsOrigins = new Set(
  (process.env.ATND_ALLOWED_CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const getAllowedOrigin = (request: Request): string | null => {
  const origin = request.headers.get('origin')
  if (!origin) return null

  try {
    const normalizedOrigin = new URL(origin).origin
    const serverOrigin = new URL(getServerSideURL()).origin
    if (normalizedOrigin === serverOrigin || configuredCorsOrigins.has(normalizedOrigin)) {
      return normalizedOrigin
    }
  } catch {
    // Malformed origins are not eligible for CORS.
  }

  return null
}

const setCorsHeaders = (res: Response, request: Request) => {
  const allowedOrigin = getAllowedOrigin(request)
  if (!allowedOrigin) return

  res.headers.set('Access-Control-Allow-Origin', allowedOrigin)
  res.headers.set('Access-Control-Allow-Methods', 'OPTIONS, GET, POST')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  res.headers.set('Vary', 'Origin')
}

export const OPTIONS = (request: NextRequest) => {
  const response = new Response(null, {
    status: 204,
  })
  setCorsHeaders(response, request)
  return response
}

const handler = async (req: NextRequest) => {
  const payload = await getPayload()

  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    router: appRouter,
    req,
    createContext: async () =>
      await createTRPCContext({
        headers: req.headers,
        payload,
        stripe,
        bookingsCollectionSlugs: ATND_ME_BOOKINGS_COLLECTION_SLUGS,
        resolveRegistrationTenantId: resolveRegistrationTenantIdForRequest,
      }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error)
    },
  })

  setCorsHeaders(response, req)
  return response
}

export { handler as GET, handler as POST }

import type { Payload } from 'payload'

import { getTenantContext } from '@/utilities/getTenantContext'
import { cookiesFromHeaders } from '@/utilities/cookiesFromHeaders'

/**
 * Resolves the tenant for passwordless self-registration from the incoming request.
 * Ensures `registrationTenant` is set for custom domains (and subdomains) when cookies
 * are not available on Payload's synthetic `req` during `payload.create`.
 */
export async function resolveRegistrationTenantIdForRequest(args: {
  payload: Payload
  headers: Headers
  hostOverride?: string
}): Promise<number | string | null> {
  const headers = new Headers(args.headers)
  const host = args.hostOverride?.trim()
  if (host && !headers.get('host')) {
    headers.set('host', host)
  }

  const tenant = await getTenantContext(args.payload, {
    headers,
    cookies: cookiesFromHeaders(headers),
  })

  return tenant?.id ?? null
}

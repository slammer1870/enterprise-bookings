import type { BetterAuthOptions } from 'better-auth'

import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'
import { cookiesFromHeaders } from '@/utilities/cookiesFromHeaders'

function headersFromAuthContext(context: unknown): Headers | null {
  if (!context || typeof context !== 'object') return null
  const c = context as { headers?: unknown; request?: unknown }
  if (c.headers instanceof Headers) return c.headers
  if (c.request instanceof Request) return c.request.headers
  return null
}

/**
 * Runs inside Better Auth's DB layer (same async context as the HTTP request).
 * The Payload adapter calls `payload.create` without `req`, so Users `beforeChange` cannot read Host/cookies; this hook injects `registrationTenant` before the adapter runs.
 */
export const registrationTenantDatabaseHooks: NonNullable<
  BetterAuthOptions['databaseHooks']
> = {
  user: {
    create: {
      before: async (user, context) => {
        const u = user as Record<string, unknown>
        if (u.registrationTenant != null && u.registrationTenant !== '') {
          return
        }
        const headers = headersFromAuthContext(context)
        if (!headers) return

        const { getPayload } = await import('@/lib/payload')
        const payload = await getPayload()
        const tenantId = await getTenantIdForCreateRequest(payload, {
          headers,
          cookies: cookiesFromHeaders(headers),
        })
        if (tenantId == null || tenantId === '') return

        return { data: { registrationTenant: tenantId } }
      },
    },
  },
}

import { toNextJsHandler } from 'better-auth/next-js'
import { getPayload } from '@/lib/payload'
import { getTrustedOriginsWithCustomDomains } from '@/lib/auth/options'

const payload = await getPayload()

const handler = toNextJsHandler(payload.betterAuth)

let cachedTrustedOrigins: string[] | null = null
let cachedAtMs = 0
let inFlight: Promise<void> | null = null

async function refreshTrustedOriginsFromTenants(): Promise<void> {
  const now = Date.now()
  const ttlMs = 60_000 // refresh at most once per minute per server instance
  if (cachedTrustedOrigins && now - cachedAtMs < ttlMs) return
  if (inFlight) return await inFlight

  inFlight = (async () => {
    try {
      const result = await payload.find({
        collection: 'tenants',
        depth: 0,
        limit: 1000,
        overrideAccess: true,
        select: { domain: true },
      })

      const tenantDomains = (result.docs as Array<{ domain?: unknown }>)
        .map((d) => (d?.domain != null ? String(d.domain).trim().toLowerCase() : ''))
        .filter(Boolean)

      const extra = [
        ...tenantDomains,
        ...tenantDomains.map((d) => `https://${d}`),
      ]

      cachedTrustedOrigins = getTrustedOriginsWithCustomDomains(extra)
      cachedAtMs = Date.now()

      // Best-effort: update Better Auth instance in-place so requests immediately accept new domains.
      ;(payload.betterAuth as any).options = {
        ...(payload.betterAuth as any).options,
        trustedOrigins: cachedTrustedOrigins,
      }
    } finally {
      inFlight = null
    }
  })()

  return await inFlight
}

export const GET = async (req: Request) => {
  await refreshTrustedOriginsFromTenants()
  return handler.GET(req)
}

export const POST = async (req: Request) => {
  await refreshTrustedOriginsFromTenants()
  return handler.POST(req)
}

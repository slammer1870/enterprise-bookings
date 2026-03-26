import config from '@payload-config'
import { REST_OPTIONS, REST_POST } from '@payloadcms/next/routes'
import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import { getServerSideURL } from '@/utilities/getURL'
import type { CollectionSlug } from 'payload'
 
type CacheEntry = { ok: boolean; expiresAt: number }
const domainAllowCache = new Map<string, CacheEntry>()
const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000
 
function getPlatformOrigin(): string | null {
  try {
    return new URL(getServerSideURL()).origin
  } catch {
    return null
  }
}
 
function getPlatformHostname(): string | null {
  try {
    return new URL(getServerSideURL()).hostname
  } catch {
    return null
  }
}
 
function parseOrigin(origin: string): URL | null {
  try {
    return new URL(origin)
  } catch {
    return null
  }
}
 
async function isAllowedCustomDomain(hostname: string): Promise<boolean> {
  const now = Date.now()
  const cached = domainAllowCache.get(hostname)
  if (cached && cached.expiresAt > now) return cached.ok
 
  const payload = await getPayload()
  const res = await payload.find({
    collection: 'tenants' as CollectionSlug,
    where: { domain: { equals: hostname } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    // Existence-only check; do not fetch tenant fields.
    select: { id: true } as any,
  })
 
  const ok = res.docs.length > 0
  domainAllowCache.set(hostname, { ok, expiresAt: now + DOMAIN_CACHE_TTL_MS })
  return ok
}
 
async function resolveAllowedOrigin(request: Request): Promise<string | null> {
  const originHeader = request.headers.get('origin')
  if (!originHeader) return null
 
  const originURL = parseOrigin(originHeader)
  if (!originURL) return null
 
  const platformOrigin = getPlatformOrigin()
  const platformHostname = getPlatformHostname()
  const { hostname } = originURL
 
  // Local dev: allow localhost + subdomains (tenant.localhost)
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1') {
    return originHeader
  }
 
  // Platform + tenant subdomains under platform root hostname
  if (platformOrigin && originHeader === platformOrigin) return originHeader
  if (platformHostname && (hostname === platformHostname || hostname.endsWith(`.${platformHostname}`))) {
    return originHeader
  }
 
  // Custom domains: only allow if they exist in tenants.domain
  if (await isAllowedCustomDomain(hostname)) return originHeader
 
  return null
}
 
function applyCorsHeaders(args: { response: Response; origin: string; request: Request }) {
  const { response, origin, request } = args
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Vary', 'Origin')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('access-control-request-headers') ?? 'Content-Type, Authorization',
  )
  response.headers.set('Access-Control-Allow-Credentials', 'true')
}
 
const payloadPOST = REST_POST(config)
const payloadOPTIONS = REST_OPTIONS(config)
 
type PayloadOptionsContext = Parameters<typeof payloadOPTIONS>[1]
type PayloadPostContext = Parameters<typeof payloadPOST>[1]

export async function OPTIONS(request: Request, context: PayloadOptionsContext) {
  const allowedOrigin = await resolveAllowedOrigin(request)
  if (!allowedOrigin) {
    return new NextResponse(null, { status: 403 })
  }
 
  const res = await payloadOPTIONS(request, context)
  applyCorsHeaders({ response: res, origin: allowedOrigin, request })
  return res
}
 
export async function POST(request: Request, context: PayloadPostContext) {
  const allowedOrigin = await resolveAllowedOrigin(request)
  if (!allowedOrigin) {
    return NextResponse.json({ error: 'CORS origin not allowed' }, { status: 403 })
  }
 
  const res = await payloadPOST(request, context)
  applyCorsHeaders({ response: res, origin: allowedOrigin, request })
  return res
}


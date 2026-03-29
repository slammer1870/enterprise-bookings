import { NextResponse } from 'next/server'
import { getPayload } from '@/lib/payload'
import type { FormSubmission } from '@/payload-types'
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

function isSubmissionBody(
  value: unknown,
): value is Pick<FormSubmission, 'form' | 'submissionData'> {
  if (!value || typeof value !== 'object') return false

  const body = value as { form?: unknown; submissionData?: unknown }
  const formValid =
    typeof body.form === 'number' ||
    (typeof body.form === 'string' && body.form.trim().length > 0)

  const submissionDataValid =
    body.submissionData == null ||
    (Array.isArray(body.submissionData) &&
      body.submissionData.every((item) => {
        if (!item || typeof item !== 'object') return false
        const row = item as { field?: unknown; value?: unknown; id?: unknown }
        const idValid = row.id == null || typeof row.id === 'string'
        return typeof row.field === 'string' && typeof row.value === 'string' && idValid
      }))

  return formValid && submissionDataValid
}
 
export async function OPTIONS(request: Request) {
  const allowedOrigin = await resolveAllowedOrigin(request)
  if (!allowedOrigin) {
    return new NextResponse(null, { status: 403 })
  }

  const res = new NextResponse(null, { status: 204 })
  applyCorsHeaders({ response: res, origin: allowedOrigin, request })
  return res
}

export async function POST(request: Request) {
  const allowedOrigin = await resolveAllowedOrigin(request)
  if (!allowedOrigin) {
    return NextResponse.json({ error: 'CORS origin not allowed' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!isSubmissionBody(body)) {
    const res = NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    applyCorsHeaders({ response: res, origin: allowedOrigin, request })
    return res
  }

  try {
    const payload = await getPayload()
    const submission = await payload.create({
      collection: 'form-submissions',
      data: {
        form: typeof body.form === 'string' ? Number(body.form) : body.form,
        submissionData: body.submissionData ?? null,
      },
      depth: 0,
      draft: false,
      overrideAccess: false,
    })

    const res = NextResponse.json(submission, { status: 201 })
    applyCorsHeaders({ response: res, origin: allowedOrigin, request })
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit form'
    const res = NextResponse.json({ error: message }, { status: 400 })
    applyCorsHeaders({ response: res, origin: allowedOrigin, request })
    return res
  }
}


import type { NextRequest } from 'next/server'

import {
  getPlatformOrigin,
  internalTenantLookupHeaders,
  isCustomPublicHostname,
  isPlatformPublicHostname,
  platformSubdomainSlug,
  type TenantHostLookupResult,
} from '@/utilities/publicHostOutcome'

type TenantHostPayload = {
  slug?: string
  id?: string | number
  canonicalHost?: string
}

function internalFetchSignal(): AbortSignal | undefined {
  return process.env.NODE_ENV !== 'production' ? AbortSignal.timeout(2000) : undefined
}

export async function fetchTenantByHostLookup(
  origin: string,
  hostname: string,
  requestHeaders?: Headers | null,
): Promise<TenantHostLookupResult> {
  const headers = internalTenantLookupHeaders({
    hostname,
    forwardForceFailure: true,
    requestHeaders,
  })
  const signal = internalFetchSignal()
  try {
    const res = await fetch(`${origin}/api/tenant-by-host?host=${encodeURIComponent(hostname)}`, {
      cache: 'no-store',
      headers,
      ...(signal && { signal }),
    })
    if (res.status === 404) return { status: 'unknown' }
    if (!res.ok) return { status: 'failed' }
    const data = (await res.json()) as TenantHostPayload | null
    if (!data) return { status: 'unknown' }
    return { status: 'ok', data }
  } catch {
    return { status: 'failed' }
  }
}

export async function fetchTenantBySlugLookup(
  origin: string,
  slug: string,
  requestHeaders?: Headers | null,
): Promise<TenantHostLookupResult> {
  const headers = internalTenantLookupHeaders({
    forwardForceFailure: true,
    requestHeaders,
  })
  const signal = internalFetchSignal()
  try {
    const res = await fetch(`${origin}/api/tenant-by-slug?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      headers,
      ...(signal && { signal }),
    })
    if (res.status === 404) return { status: 'unknown' }
    if (!res.ok) return { status: 'failed' }
    const data = (await res.json()) as TenantHostPayload | null
    if (!data) return { status: 'unknown' }
    return { status: 'ok', data }
  } catch {
    return { status: 'failed' }
  }
}

export type PublicHostLookupResult =
  | { kind: 'platform' }
  | { kind: 'tenant'; slug: string }
  | { kind: 'unknown' }
  | { kind: 'failed' }

/**
 * Whether this hostname should resolve to a tenant or be treated as unknown/failed.
 * Alias redirects are handled separately in middleware.
 */
export async function resolvePublicHostLookup(
  hostname: string,
  requestHeaders?: Headers | NextRequest['headers'] | null,
): Promise<PublicHostLookupResult> {
  const normalized = hostname.toLowerCase().split(':')[0] ?? hostname.toLowerCase()

  if (isPlatformPublicHostname(normalized)) {
    return { kind: 'platform' }
  }

  const origin = getPlatformOrigin()
  if (!origin) return { kind: 'failed' }

  const slug = platformSubdomainSlug(normalized)
  if (slug) {
    const lookup = await fetchTenantBySlugLookup(origin, slug, requestHeaders as Headers | null)
    if (lookup.status === 'failed') return { kind: 'failed' }
    if (lookup.status === 'unknown') return { kind: 'unknown' }
    const resolvedSlug = lookup.data?.slug
    return typeof resolvedSlug === 'string' && resolvedSlug
      ? { kind: 'tenant', slug: resolvedSlug }
      : { kind: 'unknown' }
  }

  if (isCustomPublicHostname(normalized)) {
    const lookup = await fetchTenantByHostLookup(origin, normalized, requestHeaders as Headers | null)
    if (lookup.status === 'failed') return { kind: 'failed' }
    if (lookup.status === 'unknown') return { kind: 'unknown' }
    const resolvedSlug = lookup.data?.slug
    return typeof resolvedSlug === 'string' && resolvedSlug
      ? { kind: 'tenant', slug: resolvedSlug }
      : { kind: 'unknown' }
  }

  return { kind: 'platform' }
}

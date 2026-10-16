import type { Payload } from 'payload'

import { getPayload } from '@/lib/payload'
import { getTenantWithBranding, type TenantWithBranding } from '@/utilities/getTenantContext'
import {
  getAbsoluteURL,
  getCanonicalHostname,
  getIndexedURL,
  getRequestOrigin,
  getTenantSiteURL,
} from '@/utilities/getURL'
import { getRequestHostname } from '@/utilities/tenantRequest'
import { readHostnameDeclaration } from '@/utilities/tenantPublicHostDeclaration'

type RequestSource = {
  cookies: Awaited<ReturnType<typeof import('next/headers').cookies>>
  headers: Awaited<ReturnType<typeof import('next/headers').headers>>
}

export type ResolvedPublicTenant = {
  payload: Payload
  tenant: TenantWithBranding | null
  indexedHost: string | null
  siteUrl: string
}

/**
 * Host named by the indexed URL. A saved hostname list supplies it.
 * Otherwise the custom domain does, or the platform subdomain when none is named.
 */
export function indexedHostnameForTenant(
  tenant?: {
    slug?: string | null
    domain?: string | null
    hostnames?: unknown
    direction?: unknown
  } | null,
): string | null {
  if (!tenant) return null
  const declaration = readHostnameDeclaration(tenant)
  if (declaration.hostnames !== null) return declaration.roles?.canonicalHost || null
  return getCanonicalHostname(tenant)
}

export async function resolvePublicTenant(source: RequestSource): Promise<ResolvedPublicTenant> {
  const payload = await getPayload()
  const tenant = await getTenantWithBranding(payload, {
    cookies: source.cookies,
    headers: source.headers,
  })
  const indexedHost = indexedHostnameForTenant(tenant)

  let siteUrl = getRequestOrigin(source.headers)
  if (tenant) {
    siteUrl = indexedHost ? `https://${indexedHost}` : getTenantSiteURL(tenant, source.headers)
  }

  return { payload, tenant, indexedHost, siteUrl }
}

/** Indexed URL when a canonical host is known; otherwise an absolute URL on `siteUrl`. */
export function publicMetadataURL(
  path: string,
  resolved: Pick<ResolvedPublicTenant, 'indexedHost' | 'siteUrl'>,
): string {
  if (resolved.indexedHost) {
    return getIndexedURL(resolved.indexedHost, path)
  }
  return getAbsoluteURL(path, resolved.siteUrl)
}

/** Sitemap line for robots.txt: always https, no port, no query. */
export function indexedSitemapURL(
  indexedHost: string | null,
  headers: RequestSource['headers'],
): string {
  if (indexedHost) {
    return getIndexedURL(indexedHost, '/sitemap.xml')
  }

  const requestHost = getRequestHostname(headers)
  if (requestHost) {
    return getIndexedURL(requestHost, '/sitemap.xml')
  }

  return getAbsoluteURL('/sitemap.xml', getRequestOrigin(headers))
}

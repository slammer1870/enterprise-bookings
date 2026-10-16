import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import {
  readHostnameDeclaration,
  storedHostnameList,
  type TenantPublicHostDocSlice,
} from '@/utilities/tenantPublicHostDeclaration'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export type TenantIdSlug = { id: number | string; slug: string }

export type HostResolution =
  | { type: 'domain'; id: number | string; slug: string; indexedHost?: string }
  /** `canonicalHost` is the redirect target: the pair partner, or the stored custom domain on a legacy row. */
  | { type: 'alias'; id: number | string; slug: string; canonicalHost: string }

type DrizzleLike = {
  execute: (query: unknown) => Promise<unknown>
}

/**
 * Shared tenant lookups for middleware-backed routes (Node runtime).
 * Uses tight `select` + `depth: 0` to minimize Postgres payload vs full documents.
 */
export async function findTenantByDomainNormalized(
  payload: Payload,
  normalizedDomain: string,
): Promise<TenantIdSlug | null> {
  const result = await payload.find({
    collection: 'tenants',
    where: { domain: { equals: normalizedDomain } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as { id?: unknown; slug?: unknown } | undefined
  if (!tenant?.slug || tenant.id == null) return null

  return { id: tenant.id as number | string, slug: String(tenant.slug) }
}

function drizzleOf(payload: Payload): DrizzleLike | null {
  const db = payload.db as { drizzle?: DrizzleLike } | undefined
  return db?.drizzle ?? null
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows)) {
    return result.rows as Array<Record<string, unknown>>
  }
  return []
}

function parsedJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/**
 * A saved hostname list is the source of which host serves.
 * Null when this hostname is not in any saved list.
 */
async function findSavedHostnameDeclaration(
  payload: Payload,
  normalizedHost: string,
): Promise<(TenantPublicHostDocSlice & { id: number | string; slug: string }) | null> {
  const drizzle = drizzleOf(payload)
  if (!drizzle) return null

  const result = await drizzle.execute(sql`
    SELECT "id", "slug", "hostnames", "direction"
    FROM "tenants"
    WHERE "hostnames" @> ${JSON.stringify([normalizedHost])}::jsonb
    LIMIT 1
  `)
  const row = rowsOf(result)[0]
  if (!row || row.slug == null || row.id == null) return null

  return {
    id: row.id as number | string,
    slug: String(row.slug),
    hostnames: parsedJson(row.hostnames),
    direction: row.direction,
  }
}

/**
 * Hostnames an origin allowlist may trust for this row.
 * A saved list contributes every named hostname. A row that has not saved a list
 * contributes its custom domain. Alias hosts on that row stay out.
 */
export function originHostnamesForTenant(doc: {
  domain?: unknown
  hostnames?: unknown
}): string[] {
  const hostnames = storedHostnameList(doc.hostnames)
  if (hostnames !== null) return [...hostnames]
  const domain = typeof doc.domain === 'string' ? normalizeCustomDomain(doc.domain) : ''
  return domain ? [domain] : []
}

/**
 * A named hostname is allowed: every hostname in a saved list, serving or alias.
 * A row that has not saved a list still allows only its custom domain.
 */
export async function namedHostnameIsAllowed(
  payload: Payload,
  normalizedHost: string,
): Promise<boolean> {
  const declared = await findSavedHostnameDeclaration(payload, normalizedHost)
  if (declared) return true

  const result = await payload.find({
    collection: 'tenants',
    where: { domain: { equals: normalizedHost } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, hostnames: true } as Record<string, boolean>,
  })
  const tenant = result.docs[0] as { hostnames?: unknown } | undefined
  if (!tenant) return false
  return storedHostnameList(tenant.hostnames) === null
}

/**
 * Resolves a request hostname to a tenant.
 * A saved hostname list serves every host that list marks as serving.
 * An alias host on that list redirects to its pair partner.
 * A row that has not been saved with that list still serves its custom domain
 * and redirects a listed alias to that domain.
 * A hostname that was not saved is not a public host.
 */
export async function findTenantByHost(
  payload: Payload,
  normalizedHost: string,
): Promise<HostResolution | null> {
  const declared = await findSavedHostnameDeclaration(payload, normalizedHost)
  if (declared) {
    const roles = readHostnameDeclaration(declared).roles
    if (roles?.servingHosts.includes(normalizedHost)) {
      return {
        type: 'domain',
        id: declared.id,
        slug: declared.slug,
        indexedHost: roles.canonicalHost,
      }
    }
    const alias = roles?.aliases.find((entry) => entry.host === normalizedHost)
    if (alias) {
      return {
        type: 'alias',
        id: declared.id,
        slug: declared.slug,
        canonicalHost: alias.target,
      }
    }
    return null
  }

  const result = await payload.find({
    collection: 'tenants',
    where: {
      or: [
        { domain: { equals: normalizedHost } },
        { aliasHosts: { equals: normalizedHost } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      slug: true,
      domain: true,
      aliasHosts: true,
      hostnames: true,
    } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as {
    id?: unknown
    slug?: unknown
    domain?: unknown
    aliasHosts?: unknown
    hostnames?: unknown
  } | undefined

  if (!tenant?.slug || tenant.id == null) return null
  // The hostname list, once saved, replaces the custom domain and the alias list.
  if (storedHostnameList(tenant.hostnames) !== null) return null

  const id = tenant.id as number | string
  const slug = String(tenant.slug)
  const domain = typeof tenant.domain === 'string' ? tenant.domain : null
  const aliasHosts = Array.isArray(tenant.aliasHosts)
    ? tenant.aliasHosts.filter((host): host is string => typeof host === 'string')
    : []

  if (domain && domain === normalizedHost) {
    return { type: 'domain', id, slug }
  }

  if (aliasHosts.includes(normalizedHost)) {
    if (!domain) return null
    return { type: 'alias', id, slug, canonicalHost: domain }
  }

  return null
}

export async function findTenantBySlugNormalized(
  payload: Payload,
  slugLower: string,
): Promise<(TenantIdSlug & TenantPublicHostDocSlice & { domain: string | null }) | null> {
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slugLower } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      slug: true,
      domain: true,
      hostnames: true,
      direction: true,
    } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as
    | (TenantPublicHostDocSlice & { id?: unknown; slug?: unknown; domain?: unknown })
    | undefined
  if (!tenant?.slug || tenant.id == null) return null

  const domain = typeof tenant.domain === 'string' && tenant.domain.trim() ? tenant.domain.trim() : null
  return {
    id: tenant.id as number | string,
    slug: String(tenant.slug),
    domain,
    hostnames: tenant.hostnames,
    direction: tenant.direction,
  }
}

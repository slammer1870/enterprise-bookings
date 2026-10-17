import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { rowsOf } from '@/utilities/drizzleRows'
import {
  readHostnameDeclaration,
  storedHostnameList,
  type TenantPublicHostDocSlice,
} from '@/utilities/tenantPublicHostDeclaration'

export type TenantIdSlug = { id: number | string; slug: string }

export type HostResolution =
  | { type: 'domain'; id: number | string; slug: string; indexedHost?: string }
  /** `canonicalHost` is the pair partner this alias host redirects to. */
  | { type: 'alias'; id: number | string; slug: string; canonicalHost: string }

type DrizzleLike = {
  execute: (query: unknown) => Promise<unknown>
}

function drizzleOf(payload: Payload): DrizzleLike | null {
  const db = payload.db as { drizzle?: DrizzleLike } | undefined
  return db?.drizzle ?? null
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

/** Every hostname in the stored list, serving or alias. An empty list contributes none. */
export function originHostnamesForTenant(doc: { hostnames?: unknown }): string[] {
  return [...(storedHostnameList(doc.hostnames) ?? [])]
}

/** A named hostname is allowed when it is in a stored hostname list, serving or alias. */
export async function namedHostnameIsAllowed(
  payload: Payload,
  normalizedHost: string,
): Promise<boolean> {
  const declared = await findSavedHostnameDeclaration(payload, normalizedHost)
  return declared != null
}

/**
 * Resolves a request hostname to a tenant from the hostname list and Direction.
 * A serving host returns the tenant. An alias host redirects to its pair partner.
 * A hostname that was not saved is not a public host.
 */
export async function findTenantByHost(
  payload: Payload,
  normalizedHost: string,
): Promise<HostResolution | null> {
  const declared = await findSavedHostnameDeclaration(payload, normalizedHost)
  if (!declared) return null

  const roles = readHostnameDeclaration(declared).roles
  if (roles.servingHosts.includes(normalizedHost)) {
    return {
      type: 'domain',
      id: declared.id,
      slug: declared.slug,
      indexedHost: roles.canonicalHost,
    }
  }
  const alias = roles.aliases.find((entry) => entry.host === normalizedHost)
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

export async function findTenantBySlugNormalized(
  payload: Payload,
  slugLower: string,
): Promise<(TenantIdSlug & TenantPublicHostDocSlice) | null> {
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slugLower } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: {
      id: true,
      slug: true,
      hostnames: true,
      direction: true,
    } as Record<string, boolean>,
  })

  const tenant = result.docs[0] as
    | (TenantPublicHostDocSlice & { id?: unknown; slug?: unknown })
    | undefined
  if (!tenant?.slug || tenant.id == null) return null

  return {
    id: tenant.id as number | string,
    slug: String(tenant.slug),
    hostnames: tenant.hostnames,
    direction: tenant.direction,
  }
}

import { sql } from '@payloadcms/db-postgres'
import type { DatabaseAdapter, Payload, PayloadRequest } from 'payload'

import { rowsOf } from '@/utilities/drizzleRows'
import {
  readHostnameDeclaration,
  storedHostnameList,
  type TenantPublicHostDocSlice,
} from '@/utilities/tenantPublicHostDeclaration'

export type TenantIdSlug = { id: number | string; slug: string }

export type HostResolution =
  /** A serving host. `indexedHost` is the canonical host named in the indexed URL. */
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

/**
 * Connection for the pre-delete overlap check.
 * `DatabaseAdapter.sessions` is the open transaction. Payload does not export `getTransaction`.
 * A finished session falls back to the adapter connection. Null means the check cannot run.
 */
async function drizzleForDeleteGuard(
  payload: Payload,
  req?: Pick<PayloadRequest, 'transactionID'>,
): Promise<DrizzleLike | null> {
  const db = payload.db as (DatabaseAdapter & { drizzle?: DrizzleLike }) | undefined
  if (!db) return null
  const transactionID = req?.transactionID != null ? await req.transactionID : undefined
  if (transactionID != null && transactionID !== '') {
    const open = db.sessions?.[String(transactionID)]
    if (open?.db) return open.db as DrizzleLike
  }
  return db.drizzle ?? null
}

function parsedJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

type SavedHostnameDeclaration = TenantPublicHostDocSlice & { id: number | string; slug: string }

/**
 * A saved hostname list is the source of which host serves.
 * Null when this hostname is not in any saved list.
 */
async function findSavedHostnameDeclaration(
  payload: Payload,
  normalizedHost: string,
): Promise<SavedHostnameDeclaration | null> {
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
 * True when some other tenant's saved hostname list still names this host.
 * Throws when the check cannot run. That is not "unlisted": the caller must leave the certificate.
 * Pass the hook `req` so the read uses the same database transaction as the save.
 */
export async function anotherTenantDeclaresHostname(
  payload: Payload,
  hostname: string,
  excludeTenantId: number | string,
  req?: Pick<PayloadRequest, 'transactionID'>,
): Promise<boolean> {
  const normalized = hostname.trim().toLowerCase()
  if (!normalized) return false
  const drizzle = await drizzleForDeleteGuard(payload, req)
  if (!drizzle) {
    throw new Error(`Cannot tell whether another tenant lists "${normalized}".`)
  }

  const result = await drizzle.execute(sql`
    SELECT "id"
    FROM "tenants"
    WHERE "id"::text <> ${excludeTenantId}::text
      AND "hostnames" @> ${JSON.stringify([normalized])}::jsonb
    LIMIT 1
  `)
  return rowsOf(result).some((row) => row.id != null)
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

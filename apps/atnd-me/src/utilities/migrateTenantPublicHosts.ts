import { DEFAULT_DIRECTION, getClaimedApex, type Direction } from '@/utilities/hostnameDirection'
import { stringsOf } from '@/utilities/stringsOf'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export type LegacyTenantPublicHostRow = {
  id: number | string
  slug: string
  domain?: string | null
  redirectApex?: boolean | null
  apexDomain?: string | null
  aliasHosts?: string[] | null
}

export type MigratedHostnameList = {
  hostnames: string[]
  direction: Direction
}

function pushOnce(hostnames: string[], host: string): void {
  const normalized = normalizeCustomDomain(host)
  if (!normalized || hostnames.includes(normalized)) return
  hostnames.push(normalized)
}

function normalizedAliases(aliasHosts: string[] | null | undefined): string[] {
  if (!Array.isArray(aliasHosts)) return []
  const aliases: string[] = []
  for (const alias of aliasHosts) {
    const normalized = normalizeCustomDomain(alias)
    if (normalized) aliases.push(normalized)
  }
  return aliases
}

/**
 * Maps one stored row onto an ordered hostname list and Allow www and non-www.
 * A www/apex pair stores only the www hostname. The apex stays off the list.
 * Does not read DNS or certificate status. Does not drop the legacy fields.
 */
export function migrateLegacyTenantPublicHosts(
  row: LegacyTenantPublicHostRow,
): MigratedHostnameList {
  const aliases = normalizedAliases(row.aliasHosts)
  const domain = typeof row.domain === 'string' ? normalizeCustomDomain(row.domain) : ''
  if (!domain) return { hostnames: [], direction: DEFAULT_DIRECTION }

  const apex = getClaimedApex(domain)
  const domainIsWww = domain === `www.${apex}`
  const domainIsApex = apex === domain
  const wwwOfApex = `www.${domain}`
  const wwwIsAlias = domainIsApex && aliases.includes(wwwOfApex)
  const hostnames: string[] = []

  if (domainIsWww) {
    pushOnce(hostnames, domain)
    for (const alias of aliases) {
      if (alias === apex) continue
      pushOnce(hostnames, alias)
    }
  } else if (wwwIsAlias) {
    pushOnce(hostnames, wwwOfApex)
    for (const alias of aliases) {
      if (alias === domain) continue
      pushOnce(hostnames, alias)
    }
  } else {
    pushOnce(hostnames, domain)
    for (const alias of aliases) pushOnce(hostnames, alias)
  }

  return { hostnames, direction: DEFAULT_DIRECTION }
}

export type HostnameListWrite = { id: number | string } & MigratedHostnameList

/** Every row is written. A www/apex pair contributes only the www hostname. */
export function publicHostRowsToWrite(rows: LegacyTenantPublicHostRow[]): HostnameListWrite[] {
  return rows.map((row) => ({ id: row.id, ...migrateLegacyTenantPublicHosts(row) }))
}

/** Turns a `tenants` select into mapping input. */
export function legacyTenantPublicHostRows(rows: unknown): LegacyTenantPublicHostRow[] {
  if (!Array.isArray(rows)) return []
  const legacy: LegacyTenantPublicHostRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const id = record.id
    const slug = record.slug
    if ((typeof id !== 'number' && typeof id !== 'string') || typeof slug !== 'string') continue
    legacy.push({
      id,
      slug,
      domain: typeof record.domain === 'string' ? record.domain : null,
      redirectApex: record.redirectApex === true,
      apexDomain: typeof record.apexDomain === 'string' ? record.apexDomain : null,
      aliasHosts: stringsOf(record.aliasHosts),
    })
  }
  return legacy
}

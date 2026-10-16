import { DEFAULT_DIRECTION, getClaimedApex, type Direction } from '@/utilities/hostnameDirection'
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

const BRU_GRAPPLING_SLUG = 'brugrappling'
const BRU_GRAPPLING_APEX = 'brugrappling.ie'
const BRU_GRAPPLING_WWW = 'www.brugrappling.ie'

function isBruGrapplingTenant(row: { slug?: string | null }): boolean {
  return (row.slug ?? '').trim().toLowerCase() === BRU_GRAPPLING_SLUG
}

function pushOnce(hostnames: string[], host: string): void {
  const normalized = normalizeCustomDomain(host)
  if (!normalized || hostnames.includes(normalized)) return
  hostnames.push(normalized)
}

/**
 * Maps one stored row onto an ordered hostname list and one Direction.
 * Does not read DNS or certificate status. Does not drop the legacy fields.
 */
export function migrateLegacyTenantPublicHosts(
  row: LegacyTenantPublicHostRow,
): MigratedHostnameList {
  const aliases = Array.isArray(row.aliasHosts) ? row.aliasHosts : []

  if (isBruGrapplingTenant(row)) {
    const hostnames = [BRU_GRAPPLING_APEX, BRU_GRAPPLING_WWW]
    for (const alias of aliases) pushOnce(hostnames, alias)
    return { hostnames, direction: 'redirect-to-non-www' }
  }

  const domain = typeof row.domain === 'string' ? normalizeCustomDomain(row.domain) : ''
  if (!domain) return { hostnames: [], direction: DEFAULT_DIRECTION }

  const parent = typeof row.apexDomain === 'string' ? normalizeCustomDomain(row.apexDomain) : ''
  const hostnames: string[] = []
  pushOnce(hostnames, domain)

  const domainIsWwwOfParent = Boolean(row.redirectApex) && parent !== '' && domain === `www.${parent}`
  const wwwOfDomain = `www.${domain}`
  const wwwAlreadyAlias =
    getClaimedApex(domain) === domain &&
    aliases.some((alias) => normalizeCustomDomain(alias) === wwwOfDomain)

  let direction: Direction = DEFAULT_DIRECTION
  if (domainIsWwwOfParent) {
    pushOnce(hostnames, parent)
    direction = 'redirect-to-www'
  } else if (wwwAlreadyAlias) {
    pushOnce(hostnames, wwwOfDomain)
    direction = 'redirect-to-non-www'
  }

  for (const alias of aliases) pushOnce(hostnames, alias)
  return { hostnames, direction }
}

export type HostnameListWrite = { id: number | string } & MigratedHostnameList

/** Every row is written, including Bru Grappling. The apex cutover is not a write gate. */
export function publicHostRowsToWrite(rows: LegacyTenantPublicHostRow[]): HostnameListWrite[] {
  return rows.map((row) => ({ id: row.id, ...migrateLegacyTenantPublicHosts(row) }))
}

function aliasHostsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((host): host is string => typeof host === 'string')
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
      aliasHosts: aliasHostsOf(record.aliasHosts),
    })
  }
  return legacy
}

import { getClaimedApex, getTenantPlatformSubdomain } from '@/utilities/tenantPublicHostDeclaration'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'

export type LegacyTenantPublicHostRow = {
  id: number | string
  slug: string
  domain?: string | null
  redirectApex?: boolean | null
}

export type MigratedTenantPublicHosts = {
  canonicalHost: string | null
  aliasHosts: string[]
  platformSubdomain: string | null
  platformSubdomainRole: 'canonical' | 'alias'
}

export const BRU_GRAPPLING_SLUG = 'bru-grappling'
const BRU_GRAPPLING_CANONICAL_HOST = 'brugrappling.ie'
const BRU_GRAPPLING_WWW_HOST = 'www.brugrappling.ie'

export function isBruGrapplingTenant(row: { slug?: string | null }): boolean {
  return (row.slug ?? '').trim().toLowerCase() === BRU_GRAPPLING_SLUG
}

function migratedDeclaration(
  slug: string,
  canonicalHost: string | null,
  aliasHosts: string[],
): MigratedTenantPublicHosts {
  return {
    canonicalHost,
    aliasHosts,
    platformSubdomain: getTenantPlatformSubdomain(slug),
    platformSubdomainRole: canonicalHost ? 'alias' : 'canonical',
  }
}

export function migrateLegacyTenantPublicHosts(
  row: LegacyTenantPublicHostRow,
): MigratedTenantPublicHosts {
  if (isBruGrapplingTenant(row)) {
    return migratedDeclaration(BRU_GRAPPLING_SLUG, BRU_GRAPPLING_CANONICAL_HOST, [
      BRU_GRAPPLING_WWW_HOST,
    ])
  }

  const domain = typeof row.domain === 'string' ? normalizeCustomDomain(row.domain) : ''
  const canonicalHost = domain === '' ? null : domain
  const aliasHosts: string[] = []
  if (canonicalHost && row.redirectApex) {
    const apex = getClaimedApex(canonicalHost)
    if (apex && apex !== canonicalHost) aliasHosts.push(apex)
  }

  return migratedDeclaration(row.slug, canonicalHost, aliasHosts)
}

export type PublicHostWrite = { id: number | string } & MigratedTenantPublicHosts

/** Non-Bru rows are written immediately. Bru's direction flip waits on cutover. */
export function publicHostRowsToWrite(
  rows: LegacyTenantPublicHostRow[],
  options: { bruCutover: boolean },
): PublicHostWrite[] {
  const writes: PublicHostWrite[] = []
  for (const row of rows) {
    if (isBruGrapplingTenant(row) && !options.bruCutover) continue
    writes.push({ id: row.id, ...migrateLegacyTenantPublicHosts(row) })
  }
  return writes
}

export function bruCutoverConfirmed(argv: readonly string[]): boolean {
  return argv.includes('--apex-cname-live') && argv.includes('--homepage-rule-removed')
}

/** Turns a `tenants` select (`redirect_apex` aliased as `redirectApex`) into mapping input. */
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
    })
  }
  return legacy
}

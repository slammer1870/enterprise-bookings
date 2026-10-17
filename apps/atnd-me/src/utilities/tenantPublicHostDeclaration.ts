import {
  canonicalHostFromList,
  getClaimedApex,
  parseDirection,
  type Direction,
} from '@/utilities/hostnameDirection'
import { getPlatformRootHostname, normalizeCustomDomain } from '@/utilities/publicHostname'

export {
  DEFAULT_DIRECTION,
  DIRECTION_CHOICES,
  directionRefusal,
  getClaimedApex,
  HOSTNAME_DIRECTIONS,
  parseDirection,
  type Direction,
} from '@/utilities/hostnameDirection'

export type AliasHost = {
  host: string
  target: string
}

/** Roles derived from a stored hostname list and Direction. They are not stored. */
export type DerivedPublicHostRoles = {
  canonicalHost: string
  servingHosts: string[]
  aliases: AliasHost[]
}

export type HostnameDeclarationRead = {
  hostnames: string[]
  direction: Direction
  roles: DerivedPublicHostRoles
}

/** The stored hostname list and Direction. Roles are derived when this is read. */
export type TenantPublicHostDeclaration = {
  hostnames: string[]
  direction: Direction
  slug: string
}

export type TenantPublicHostDocSlice = {
  hostnames?: unknown
  direction?: unknown
  slug?: unknown
}

export function getTenantPlatformSubdomain(slug: string): string | null {
  const root = getPlatformRootHostname()
  const normalizedSlug = slug.trim().toLowerCase()
  if (!root || !normalizedSlug) return null
  return `${normalizedSlug}.${root}`
}

export function slugFromPlatformSubdomain(hostname: string): string | null {
  const root = getPlatformRootHostname()
  if (!root) return null
  const normalized = hostname.trim().toLowerCase()
  const suffix = `.${root}`
  if (!normalized.endsWith(suffix)) return null
  const label = normalized.slice(0, -suffix.length)
  if (!label || label.includes('.')) return null
  return label
}

function normalizeAliasHostsList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const host of value) {
    if (host == null) continue
    const normalized = normalizeCustomDomain(String(host))
    if (normalized) out.push(normalized)
  }
  return out
}

export function normalizeHostnameList(value: unknown): string[] {
  return normalizeAliasHostsList(value)
}

/**
 * Null means this row has not been saved with a hostname list.
 * An array, including an empty one, is a stored list.
 */
export function storedHostnameList(value: unknown): string[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  return normalizeHostnameList(value)
}

function wwwHostOf(apex: string): string {
  return `www.${apex}`
}

/** A hostname is in a pair only when it is `www` of its registrable domain, or that apex, and both are named. */
function pairSide(hostname: string, named: Set<string>): 'www' | 'apex' | null {
  const apex = getClaimedApex(hostname)
  const www = wwwHostOf(apex)
  if (!named.has(apex) || !named.has(www)) return null
  if (hostname === www) return 'www'
  if (hostname === apex) return 'apex'
  return null
}

function derivePublicHostRoles(
  hostnames: string[],
  direction: Direction,
  slug: string,
): DerivedPublicHostRoles {
  const platformHost = getTenantPlatformSubdomain(slug)
  if (hostnames.length === 0) {
    return {
      canonicalHost: platformHost ?? '',
      servingHosts: platformHost ? [platformHost] : [],
      aliases: [],
    }
  }

  const canonicalHost = canonicalHostFromList(hostnames, direction)
  const named = new Set(hostnames)
  const servingHosts: string[] = []
  const aliases: AliasHost[] = []

  for (const host of hostnames) {
    const side = pairSide(host, named)
    if (side === null || direction === 'allow-www-and-non-www') {
      servingHosts.push(host)
      continue
    }
    if (direction === 'redirect-to-www' && side === 'apex') {
      aliases.push({ host, target: wwwHostOf(getClaimedApex(host)) })
      continue
    }
    if (direction === 'redirect-to-non-www' && side === 'www') {
      aliases.push({ host, target: getClaimedApex(host) })
      continue
    }
    servingHosts.push(host)
  }

  if (platformHost) aliases.push({ host: platformHost, target: canonicalHost })

  return { canonicalHost, servingHosts, aliases }
}

export function readHostnameDeclaration(doc: TenantPublicHostDocSlice): HostnameDeclarationRead {
  const hostnames = storedHostnameList(doc.hostnames) ?? []
  const direction = parseDirection(doc.direction)
  const slug = typeof doc.slug === 'string' ? doc.slug : ''
  return {
    hostnames,
    direction,
    roles: derivePublicHostRoles(hostnames, direction, slug),
  }
}

export function mergeTenantPublicHostDeclaration(
  data: TenantPublicHostDocSlice,
  originalDoc?: TenantPublicHostDocSlice | null,
): TenantPublicHostDeclaration {
  const slugRaw =
    typeof data.slug === 'string' && data.slug.trim()
      ? data.slug
      : typeof originalDoc?.slug === 'string'
        ? originalDoc.slug
        : ''
  const slug = slugRaw.trim().toLowerCase()

  let hostnames = storedHostnameList(originalDoc?.hostnames) ?? []
  if (Object.prototype.hasOwnProperty.call(data, 'hostnames')) {
    hostnames = storedHostnameList(data.hostnames) ?? []
  }

  let direction = parseDirection(originalDoc?.direction)
  if (Object.prototype.hasOwnProperty.call(data, 'direction')) {
    direction = parseDirection(data.direction)
  }

  return { hostnames, direction, slug }
}

export function listDeclaredCustomHostnames(declaration: TenantPublicHostDeclaration): string[] {
  return [...declaration.hostnames]
}

/** Declared custom hosts plus the assigned platform subdomain (reserved, not declared). */
export function listOccupiedPublicHostnames(declaration: TenantPublicHostDeclaration): string[] {
  const hosts = listDeclaredCustomHostnames(declaration)
  const platformHost = getTenantPlatformSubdomain(declaration.slug)
  if (platformHost) hosts.push(platformHost)
  return hosts
}

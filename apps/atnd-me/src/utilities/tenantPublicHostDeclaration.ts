import { parse as parseHostname } from 'tldts'
import type { PayloadRequest, Where } from 'payload'
import {
  getPlatformRootHostname,
  normalizeCustomDomain,
  validateAliasHosts,
  validateCustomDomainFormat,
  validateCustomDomainNotPlatform,
} from '@/utilities/validateCustomDomain'

const OTHER_DECLARATIONS_CACHE_KEY = 'tenantPublicHostOtherDeclarations'

export const HOSTNAME_DIRECTIONS = [
  'allow-www-and-non-www',
  'redirect-to-www',
  'redirect-to-non-www',
] as const

export type Direction = (typeof HOSTNAME_DIRECTIONS)[number]

export const DEFAULT_DIRECTION: Direction = 'allow-www-and-non-www'

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
  hostnames: string[] | null
  direction: Direction
  roles: DerivedPublicHostRoles | null
}

export type TenantPublicHostDeclaration = {
  canonicalHost: string | null
  aliasHosts: string[]
  /** Null until the tenant is saved with the hostname list. An empty array is a saved empty list. */
  hostnames: string[] | null
  direction: Direction
  slug: string
}

export type TenantPublicHostDocSlice = {
  domain?: unknown
  aliasHosts?: unknown
  hostnames?: unknown
  direction?: unknown
  slug?: unknown
}

export function getClaimedApex(hostname: string): string {
  const normalized = hostname.trim().toLowerCase()
  const parsed = parseHostname(normalized, { allowPrivateDomains: true })
  if (parsed.domain) return parsed.domain
  const labels = normalized.split('.').filter(Boolean)
  if (labels.length >= 2) return labels.slice(-2).join('.')
  return normalized
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

export function parseDirection(value: unknown): Direction {
  if (
    value === 'allow-www-and-non-www' ||
    value === 'redirect-to-www' ||
    value === 'redirect-to-non-www'
  ) {
    return value
  }
  return DEFAULT_DIRECTION
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

function canonicalHostFromList(hostnames: string[], direction: Direction): string {
  const first = hostnames[0]
  if (!first) return ''
  const apex = getClaimedApex(first)
  const www = wwwHostOf(apex)
  const named = new Set(hostnames)
  if (direction === 'redirect-to-www' && named.has(www)) return www
  if (named.has(apex)) return apex
  return first
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
  const hostnames = storedHostnameList(doc.hostnames)
  const direction = parseDirection(doc.direction)
  const slug = typeof doc.slug === 'string' ? doc.slug : ''
  if (hostnames === null) {
    return { hostnames: null, direction, roles: null }
  }
  return {
    hostnames,
    direction,
    roles: derivePublicHostRoles(hostnames, direction, slug),
  }
}

/** Why this Direction cannot be saved for this list. Null when the list can take it. */
export function directionRefusal(hostnames: string[], direction: Direction): string | null {
  if (direction === 'allow-www-and-non-www') return null
  const first = hostnames[0]
  if (!first) {
    if (direction === 'redirect-to-www') {
      return 'Redirect to www needs www of the first hostname in the list.'
    }
    return 'Redirect to non-www needs the apex of the first hostname in the list.'
  }
  const apex = getClaimedApex(first)
  const www = wwwHostOf(apex)
  const named = new Set(hostnames)
  if (direction === 'redirect-to-www' && !named.has(www)) {
    return `Redirect to www needs ${www} in the hostname list.`
  }
  if (direction === 'redirect-to-non-www' && !named.has(apex)) {
    return `Redirect to non-www needs ${apex} in the hostname list.`
  }
  return null
}

function validateHostnameNotPlatform(hostname: string): true | string {
  const notPlatform = validateCustomDomainNotPlatform(hostname)
  if (notPlatform !== true) return notPlatform

  const root = getPlatformRootHostname()
  if (!root) return true
  const apex = getClaimedApex(root)
  if (hostname === apex || hostname.endsWith(`.${apex}`)) {
    return `Cannot use the platform domain (${apex}) as a public host.`
  }
  return true
}

export function assertHostnameList(hostnames: string[], direction: Direction): void {
  const seen = new Set<string>()
  for (const hostname of hostnames) {
    if (seen.has(hostname)) {
      throw new Error('Each public host can only be listed once.')
    }
    seen.add(hostname)
    const format = validateDeclaredHostname(hostname)
    if (format !== true) throw new Error(format)
    const platform = validateHostnameNotPlatform(hostname)
    if (platform !== true) throw new Error(platform)
  }
  const refusal = directionRefusal(hostnames, direction)
  if (refusal) throw new Error(refusal)
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

  let canonicalHost: string | null =
    typeof originalDoc?.domain === 'string' && originalDoc.domain.trim()
      ? normalizeCustomDomain(originalDoc.domain)
      : null
  if (Object.prototype.hasOwnProperty.call(data, 'domain')) {
    if (data.domain == null || data.domain === '') {
      canonicalHost = null
    } else if (typeof data.domain === 'string') {
      const normalized = normalizeCustomDomain(data.domain)
      canonicalHost = normalized === '' ? null : normalized
    }
  }

  let aliasHosts = normalizeAliasHostsList(originalDoc?.aliasHosts)
  if (Object.prototype.hasOwnProperty.call(data, 'aliasHosts')) {
    aliasHosts = normalizeAliasHostsList(data.aliasHosts)
  }

  let hostnames = storedHostnameList(originalDoc?.hostnames)
  if (Object.prototype.hasOwnProperty.call(data, 'hostnames')) {
    hostnames = storedHostnameList(data.hostnames)
  }

  let direction = parseDirection(originalDoc?.direction)
  if (Object.prototype.hasOwnProperty.call(data, 'direction')) {
    direction = parseDirection(data.direction)
  }

  return { canonicalHost, aliasHosts, hostnames, direction, slug }
}

export function listDeclaredCustomHostnames(declaration: TenantPublicHostDeclaration): string[] {
  const hosts: string[] = []
  if (declaration.canonicalHost) hosts.push(declaration.canonicalHost)
  hosts.push(...declaration.aliasHosts)
  if (declaration.hostnames) {
    for (const host of declaration.hostnames) {
      if (!hosts.includes(host)) hosts.push(host)
    }
  }
  return hosts
}

/** Declared custom hosts plus the assigned platform subdomain (reserved, not declared). */
export function listOccupiedPublicHostnames(declaration: TenantPublicHostDeclaration): string[] {
  const hosts = listDeclaredCustomHostnames(declaration)
  const platformHost = getTenantPlatformSubdomain(declaration.slug)
  if (platformHost) hosts.push(platformHost)
  return hosts
}

export function validateTenantPublicHostDeclarationStructure(args: {
  canonicalHost: string | null
  aliasHosts: string[]
  slug: string
  previousCanonicalHost?: string | null
}): true | string {
  const { canonicalHost, aliasHosts } = args

  if (aliasHosts.length > 0 && !canonicalHost) {
    if (args.previousCanonicalHost) {
      return 'Clear the alias hosts before removing the canonical host.'
    }
    return 'Name a canonical host before adding alias hosts.'
  }

  const seen = new Set<string>()
  if (canonicalHost) {
    if (seen.has(canonicalHost)) {
      return 'Each public host can only be listed once.'
    }
    seen.add(canonicalHost)
  }

  for (const alias of aliasHosts) {
    if (canonicalHost && alias === canonicalHost) {
      return 'The canonical host cannot also be listed as an alias host.'
    }
    if (seen.has(alias)) {
      return 'Each public host can only be listed once.'
    }
    seen.add(alias)
  }

  return true
}

function validateDeclaredHostname(hostname: string): true | string {
  const format = validateCustomDomainFormat(hostname)
  if (format !== true) return format
  const notPlatform = validateCustomDomainNotPlatform(hostname)
  if (notPlatform !== true) return notPlatform
  return true
}

export function validateDeclaredHostnamesFormat(
  canonicalHost: string | null,
  aliasHosts: string[],
): true | string {
  if (canonicalHost) {
    const result = validateDeclaredHostname(canonicalHost)
    if (result !== true) return result
  }
  const aliasResult = validateAliasHosts(aliasHosts)
  if (aliasResult !== true) return aliasResult
  return true
}

/**
 * Validates hostname shape before normalization strips ports.
 * Letters may be uppercase; the stored hostname is lowercase.
 */
export function validateHostnameInputBeforeNormalize(value: string): true | string {
  const trimmed = value.trim()
  if (trimmed === '') return true
  return validateCustomDomainFormat(trimmed.toLowerCase())
}

/** Refuses scheme, port, and other invalid shapes on fields included in this write. */
export function validateRawPublicHostInputs(data: TenantPublicHostDocSlice): void {
  if (Object.prototype.hasOwnProperty.call(data, 'domain') && typeof data.domain === 'string') {
    const rawDomain = data.domain
    if (rawDomain.trim() !== '') {
      const rawCheck = validateHostnameInputBeforeNormalize(rawDomain)
      if (rawCheck !== true) throw new Error(rawCheck)
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'aliasHosts') && Array.isArray(data.aliasHosts)) {
    for (const host of data.aliasHosts) {
      if (host == null) continue
      const rawCheck = validateHostnameInputBeforeNormalize(String(host))
      if (rawCheck !== true) throw new Error(rawCheck)
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, 'hostnames') && Array.isArray(data.hostnames)) {
    for (const host of data.hostnames) {
      if (host == null) continue
      const rawCheck = validateHostnameInputBeforeNormalize(String(host))
      if (rawCheck !== true) throw new Error(rawCheck)
    }
  }
}

function conflictErrorForHostname(hostname: string): string {
  const platformSlug = slugFromPlatformSubdomain(hostname)
  if (platformSlug) {
    return `Cannot use "${hostname}" — it is reserved for the tenant subdomain "${platformSlug}".`
  }
  return `Another tenant already uses the public host "${hostname}".`
}

function findOccupiedHostnameOwner(
  hostname: string,
  others: TenantPublicHostDeclaration[],
): TenantPublicHostDeclaration | null {
  for (const other of others) {
    for (const occupied of listOccupiedPublicHostnames(other)) {
      if (occupied === hostname) return other
    }
  }
  return null
}

async function loadOtherTenantDeclarations(
  req: PayloadRequest,
  excludeTenantId: number | string | null,
): Promise<TenantPublicHostDeclaration[]> {
  const cacheScope = excludeTenantId ?? 'create'
  const context = req.context as Record<string, unknown>
  const cached = context[`${OTHER_DECLARATIONS_CACHE_KEY}:${cacheScope}`]
  if (Array.isArray(cached)) {
    return cached as TenantPublicHostDeclaration[]
  }

  const declarations: TenantPublicHostDeclaration[] = []
  let page = 1
  const limit = 100
  const where: Where =
    excludeTenantId != null ? { id: { not_equals: excludeTenantId } } : {}

  while (true) {
    const result = await req.payload.find({
      collection: 'tenants',
      where,
      page,
      limit,
      depth: 0,
      overrideAccess: true,
      req,
      select: { slug: true, domain: true, aliasHosts: true, hostnames: true, direction: true },
    })

    for (const doc of result.docs) {
      declarations.push(mergeTenantPublicHostDeclaration({}, doc as TenantPublicHostDocSlice))
    }

    if (!result.hasNextPage) break
    page += 1
  }

  context[`${OTHER_DECLARATIONS_CACHE_KEY}:${cacheScope}`] = declarations
  return declarations
}

export async function assertTenantPublicHostDeclaration(
  req: PayloadRequest,
  declaration: TenantPublicHostDeclaration,
  excludeTenantId: number | string | null,
): Promise<void> {
  const structure = validateTenantPublicHostDeclarationStructure(declaration)
  if (structure !== true) {
    throw new Error(structure)
  }

  const format = validateDeclaredHostnamesFormat(declaration.canonicalHost, declaration.aliasHosts)
  if (format !== true) {
    throw new Error(format)
  }

  const myHosts = listOccupiedPublicHostnames(declaration)
  const myApexes = new Set(listDeclaredCustomHostnames(declaration).map(getClaimedApex))
  const others = await loadOtherTenantDeclarations(req, excludeTenantId)

  for (const host of myHosts) {
    const owner = findOccupiedHostnameOwner(host, others)
    if (owner) {
      throw new Error(conflictErrorForHostname(host))
    }
  }

  for (const other of others) {
    for (const otherHost of listDeclaredCustomHostnames(other)) {
      const apex = getClaimedApex(otherHost)
      if (myApexes.has(apex)) {
        throw new Error(
          `Another tenant already names a hostname on "${apex}". Remove their hostname there before naming one on this apex.`,
        )
      }
    }
  }
}

export async function validateTenantPublicHostDeclarationOnSave(args: {
  req: PayloadRequest
  operation: 'create' | 'update'
  tenantId: number | string | null
  data: TenantPublicHostDocSlice
  originalDoc?: TenantPublicHostDocSlice | null
}): Promise<void> {
  const touchesHosts =
    Object.prototype.hasOwnProperty.call(args.data, 'domain') ||
    Object.prototype.hasOwnProperty.call(args.data, 'aliasHosts') ||
    Object.prototype.hasOwnProperty.call(args.data, 'hostnames') ||
    Object.prototype.hasOwnProperty.call(args.data, 'direction') ||
    Object.prototype.hasOwnProperty.call(args.data, 'slug')

  if (!touchesHosts && args.operation !== 'create') return

  const merged = mergeTenantPublicHostDeclaration(args.data, args.originalDoc)
  const previousCanonical =
    typeof args.originalDoc?.domain === 'string' && args.originalDoc.domain.trim()
      ? normalizeCustomDomain(args.originalDoc.domain)
      : null

  const structure = validateTenantPublicHostDeclarationStructure({
    ...merged,
    previousCanonicalHost: Object.prototype.hasOwnProperty.call(args.data, 'domain')
      ? previousCanonical
      : undefined,
  })
  if (structure !== true) {
    throw new Error(structure)
  }

  const writesHostnameList = Object.prototype.hasOwnProperty.call(args.data, 'hostnames')
  const writesDirection = Object.prototype.hasOwnProperty.call(args.data, 'direction')
  if (merged.hostnames !== null) {
    assertHostnameList(merged.hostnames, merged.direction)
  } else if (
    (writesHostnameList || writesDirection) &&
    merged.direction !== DEFAULT_DIRECTION
  ) {
    const refusal = directionRefusal([], merged.direction)
    if (refusal) throw new Error(refusal)
  }

  await assertTenantPublicHostDeclaration(args.req, merged, args.tenantId)
}

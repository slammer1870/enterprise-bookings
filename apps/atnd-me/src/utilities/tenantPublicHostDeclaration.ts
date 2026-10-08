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

export type TenantPublicHostDeclaration = {
  canonicalHost: string | null
  aliasHosts: string[]
  slug: string
}

export type TenantPublicHostDocSlice = {
  domain?: unknown
  aliasHosts?: unknown
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

  return { canonicalHost, aliasHosts, slug }
}

export function listDeclaredCustomHostnames(declaration: TenantPublicHostDeclaration): string[] {
  const hosts: string[] = []
  if (declaration.canonicalHost) hosts.push(declaration.canonicalHost)
  hosts.push(...declaration.aliasHosts)
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

/** Validates hostname shape before normalization strips ports. */
export function validateHostnameInputBeforeNormalize(value: string): true | string {
  const trimmed = value.trim()
  if (trimmed === '') return true
  return validateCustomDomainFormat(trimmed)
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
      select: { slug: true, domain: true, aliasHosts: true },
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

  await assertTenantPublicHostDeclaration(args.req, merged, args.tenantId)
}

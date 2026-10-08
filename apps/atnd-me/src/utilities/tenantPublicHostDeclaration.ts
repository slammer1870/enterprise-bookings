import { isIP } from 'node:net'
import { parse as parseHostname } from 'tldts'
import type { Payload, Where } from 'payload'
import {
  getPlatformRootHostname,
  normalizeCustomDomain,
  validateAliasHosts,
  validateCustomDomainFormat,
  validateCustomDomainNotPlatform,
} from '@/utilities/validateCustomDomain'

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

export function validateHostnameInputBeforeNormalize(value: string): true | string {
  const trimmed = value.trim()
  if (trimmed === '') return true
  if (trimmed.includes('://') || trimmed.includes('/')) {
    return 'Enter only the hostname (e.g. studio.example.com), without protocol or path.'
  }
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return 'Hostname must not start or end with a dot.'
  }
  if (/:[0-9]{1,5}$/.test(trimmed)) {
    return 'Hostname must not include a port.'
  }
  if (isIP(trimmed)) {
    return 'Cannot use an IP address as a public host.'
  }
  return true
}

async function findTenantConflictingWithHostname(
  payload: Payload,
  hostname: string,
  excludeTenantId: number | string | null,
): Promise<{ id: number | string; slug: string } | null> {
  const slugGuess = slugFromPlatformSubdomain(hostname)
  const or: Where[] = [
    { domain: { equals: hostname } },
    { aliasHosts: { equals: hostname } },
  ]
  if (slugGuess) {
    or.push({ slug: { equals: slugGuess } })
  }

  const and: Where[] = [{ or }]
  if (excludeTenantId != null) {
    and.unshift({ id: { not_equals: excludeTenantId } })
  }

  const result = await payload.find({
    collection: 'tenants',
    where: { and },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, slug: true } as Record<string, boolean>,
  })

  const doc = result.docs[0] as { id?: unknown; slug?: unknown } | undefined
  if (!doc?.id || !doc.slug) return null
  return { id: doc.id as number | string, slug: String(doc.slug) }
}

async function loadOtherTenantDeclarations(
  payload: Payload,
  excludeTenantId: number | string | null,
): Promise<TenantPublicHostDeclaration[]> {
  const declarations: TenantPublicHostDeclaration[] = []
  let page = 1
  const limit = 100

  while (true) {
    const result = await payload.find({
      collection: 'tenants',
      where: excludeTenantId != null ? { id: { not_equals: excludeTenantId } } : {},
      page,
      limit,
      depth: 0,
      overrideAccess: true,
      select: { id: true, slug: true, domain: true, aliasHosts: true } as Record<string, boolean>,
    })

    for (const doc of result.docs) {
      const slice = doc as TenantPublicHostDocSlice
      declarations.push(mergeTenantPublicHostDeclaration({}, slice))
    }

    if (!result.hasNextPage) break
    page += 1
  }

  return declarations
}

export async function assertTenantPublicHostDeclaration(
  payload: Payload,
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

  for (const host of myHosts) {
    const owner = await findTenantConflictingWithHostname(payload, host, excludeTenantId)
    if (owner) {
      const platformSlug = slugFromPlatformSubdomain(host)
      if (platformSlug) {
        throw new Error(
          `Cannot use "${host}" — it is reserved for the tenant subdomain "${platformSlug}".`,
        )
      }
      throw new Error(`Another tenant already uses the public host "${host}".`)
    }
  }

  const others = await loadOtherTenantDeclarations(payload, excludeTenantId)
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
  payload: Payload
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

  if (Object.prototype.hasOwnProperty.call(args.data, 'domain') && typeof args.data.domain === 'string') {
    const rawDomain = args.data.domain
    if (rawDomain.trim() !== '') {
      const rawCheck = validateHostnameInputBeforeNormalize(rawDomain)
      if (rawCheck !== true) throw new Error(rawCheck)
    }
  }

  if (Object.prototype.hasOwnProperty.call(args.data, 'aliasHosts') && Array.isArray(args.data.aliasHosts)) {
    for (const host of args.data.aliasHosts) {
      if (host == null) continue
      const rawCheck = validateHostnameInputBeforeNormalize(String(host))
      if (rawCheck !== true) throw new Error(rawCheck)
    }
  }

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

  await assertTenantPublicHostDeclaration(args.payload, merged, args.tenantId)
}

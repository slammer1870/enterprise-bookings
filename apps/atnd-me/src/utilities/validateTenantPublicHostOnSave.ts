import { APIError, type PayloadRequest, type Where } from 'payload'

import { directionRefusal, getClaimedApex, type Direction } from '@/utilities/hostnameDirection'
import { getPlatformRootHostname } from '@/utilities/publicHostname'
import {
  listDeclaredCustomHostnames,
  listOccupiedPublicHostnames,
  mergeTenantPublicHostDeclaration,
  slugFromPlatformSubdomain,
  type TenantPublicHostDeclaration,
  type TenantPublicHostDocSlice,
} from '@/utilities/tenantPublicHostDeclaration'
import {
  validateCustomDomainFormat,
  validateCustomDomainNotPlatform,
} from '@/utilities/validateCustomDomain'

const OTHER_DECLARATIONS_CACHE_KEY = 'tenantPublicHostOtherDeclarations'

/** A refused declaration is a client error so the admin can read why the save did not stick. */
function refuseDeclaration(message: string): never {
  throw new APIError(message, 400)
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

function validateDeclaredHostname(hostname: string): true | string {
  return validateCustomDomainFormat(hostname)
}

export function assertHostnameList(hostnames: string[], direction: Direction): void {
  const seen = new Set<string>()
  for (const hostname of hostnames) {
    if (seen.has(hostname)) {
      refuseDeclaration('Each public host can only be listed once.')
    }
    seen.add(hostname)
    const format = validateDeclaredHostname(hostname)
    if (format !== true) refuseDeclaration(format)
    const platform = validateHostnameNotPlatform(hostname)
    if (platform !== true) refuseDeclaration(platform)
  }
  const refusal = directionRefusal(hostnames, direction)
  if (refusal) refuseDeclaration(refusal)
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

/** Refuses scheme, port, and other invalid shapes on the hostname list in this write. */
export function validateRawPublicHostInputs(data: TenantPublicHostDocSlice): void {
  if (Object.prototype.hasOwnProperty.call(data, 'hostnames') && Array.isArray(data.hostnames)) {
    for (const host of data.hostnames) {
      if (host == null) continue
      const rawCheck = validateHostnameInputBeforeNormalize(String(host))
      if (rawCheck !== true) refuseDeclaration(rawCheck)
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
  const where: Where = excludeTenantId != null ? { id: { not_equals: excludeTenantId } } : {}

  while (true) {
    const result = await req.payload.find({
      collection: 'tenants',
      where,
      page,
      limit,
      depth: 0,
      overrideAccess: true,
      req,
      select: { slug: true, hostnames: true, direction: true },
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
  const myHosts = listOccupiedPublicHostnames(declaration)
  const myApexes = new Set(listDeclaredCustomHostnames(declaration).map(getClaimedApex))
  const others = await loadOtherTenantDeclarations(req, excludeTenantId)

  for (const host of myHosts) {
    const owner = findOccupiedHostnameOwner(host, others)
    if (owner) {
      refuseDeclaration(conflictErrorForHostname(host))
    }
  }

  for (const other of others) {
    for (const otherHost of listDeclaredCustomHostnames(other)) {
      const apex = getClaimedApex(otherHost)
      if (myApexes.has(apex)) {
        refuseDeclaration(
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
    Object.prototype.hasOwnProperty.call(args.data, 'hostnames') ||
    Object.prototype.hasOwnProperty.call(args.data, 'direction') ||
    Object.prototype.hasOwnProperty.call(args.data, 'slug')

  if (!touchesHosts && args.operation !== 'create') return

  const merged = mergeTenantPublicHostDeclaration(args.data, args.originalDoc)
  assertHostnameList(merged.hostnames, merged.direction)
  await assertTenantPublicHostDeclaration(args.req, merged, args.tenantId)
}

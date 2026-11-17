import { getTenantMembershipIdsFromUserDoc } from '../../access/tenant-scoped'
import { isAdmin } from '../../access/userTenantAccess'
import { getTenantIdForCreateRequest } from '@/utilities/getTenantContext'
import { cookiesFromHeaders } from '@/utilities/cookiesFromHeaders'
import { resolveTenantIdForDocumentWrite } from '@/utilities/resolveTenantIdForDocumentWrite'
import { canAssignRegistrationTenant } from './canAssignRegistrationTenant'
import { extractTenantId, type TenantEntry } from './tenantHookHelpers'

type EnsureCreateTenantScopeArgs = {
  data: Record<string, unknown>
  req: {
    user?: unknown
    context?: Record<string, unknown>
    headers?: Headers | { get?: (name: string) => string | null }
    payload?: {
      // Method syntax stays bivariant, so a real Payload `findByID` and a test
      // mock both assign. A function property would reject PayloadRequest.
      findByID?(args: Record<string, unknown>): Promise<unknown>
    }
  }
}

/** Numeric ids match `extractTenantId`. Non-numeric strings (slugs) pass through. */
function coerceTenantId(raw: unknown): number | string | null {
  if (typeof raw === 'string') {
    if (raw.trim() === '') return null
    return extractTenantId(raw) ?? raw
  }
  const numeric = extractTenantId(raw)
  if (numeric != null) return numeric
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return coerceTenantId((raw as { id: unknown }).id)
  }
  return null
}

function firstTenantIdFromMembership(tenants: unknown): number | string | null {
  if (!Array.isArray(tenants) || tenants.length === 0) return null
  for (const entry of tenants) {
    if (!entry || typeof entry !== 'object') continue
    const id = extractTenantId((entry as TenantEntry).tenant)
    if (id != null) return id
  }
  return null
}

function acceptOwnedTenant(allowed: number[], raw: unknown): number | null {
  const id = coerceTenantId(raw)
  if (typeof id !== 'number' || !allowed.includes(id)) return null
  return id
}

function firstOwnedTenantId(tenants: unknown, allowed: number[]): number | null {
  if (!Array.isArray(tenants)) return null
  for (const entry of tenants) {
    if (!entry || typeof entry !== 'object') continue
    const id = acceptOwnedTenant(allowed, (entry as TenantEntry).tenant)
    if (id != null) return id
  }
  return null
}

/**
 * Tenant id from the selector cookie / host, ignoring `context.tenant`.
 * A context value the actor does not belong to must not hide the selector.
 */
async function tenantIdFromSelector(
  req: EnsureCreateTenantScopeArgs['req'],
): Promise<number | string | null> {
  const selectorReq = {
    ...req,
    context: {
      ...(req.context ?? {}),
      tenant: undefined,
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fromSelector = await resolveTenantIdForDocumentWrite(selectorReq as any)
  if (fromSelector == null || fromSelector === '') return null
  return fromSelector
}

/**
 * Resolve the tenant an admin (or public host) create should stamp onto a new user.
 *
 * Super-admins and anonymous signups may use an explicit registrationTenant.
 * Org admins and location-managers may not: the selected tenant (context, then
 * the TenantSelector cookie) wins, and a client id is used only when it is one
 * of their memberships. A single membership is the fallback. Several memberships
 * and no selection do not guess the first row.
 */
export async function resolveTenantIdForUserCreate(
  data: Record<string, unknown>,
  req: EnsureCreateTenantScopeArgs['req'],
): Promise<number | string | null> {
  const user = req.user

  if (!user) {
    const fromReg = coerceTenantId(data.registrationTenant)
    if (fromReg != null) return fromReg

    const fromMembership = firstTenantIdFromMembership(data.tenants)
    if (fromMembership != null) return fromMembership

    if (req.headers && typeof (req.headers as Headers).get === 'function') {
      const headers = req.headers as Headers
      const fromRequest = await getTenantIdForCreateRequest(req.payload as never, {
        headers,
        cookies: cookiesFromHeaders(headers),
        context: req.context as { tenant?: unknown } | undefined,
      })
      if (fromRequest != null && fromRequest !== '') {
        try {
          const tenant = await req.payload?.findByID?.({
            collection: 'tenants',
            id: fromRequest,
            depth: 0,
            overrideAccess: true,
            req,
          })
          if (tenant) return fromRequest
        } catch {
          return null
        }
      }
    }

    return null
  }

  if (!canAssignRegistrationTenant(user)) return null

  if (isAdmin(user)) {
    const fromReg = coerceTenantId(data.registrationTenant)
    if (fromReg != null) return fromReg

    const fromMembership = firstTenantIdFromMembership(data.tenants)
    if (fromMembership != null) return fromMembership

    const fromCtx = coerceTenantId(req.context?.tenant)
    if (fromCtx != null) return fromCtx

    return tenantIdFromSelector(req)
  }

  const allowed = getTenantMembershipIdsFromUserDoc(user)

  const fromCtx = acceptOwnedTenant(allowed, req.context?.tenant)
  if (fromCtx != null) return fromCtx

  const fromSelector = acceptOwnedTenant(allowed, await tenantIdFromSelector(req))
  if (fromSelector != null) return fromSelector

  const fromReg = acceptOwnedTenant(allowed, data.registrationTenant)
  if (fromReg != null) return fromReg

  const fromRow = firstOwnedTenantId(data.tenants, allowed)
  if (fromRow != null) return fromRow

  if (allowed.length === 1) return allowed[0]!

  return null
}

function retainOwnedTenantRows(data: Record<string, unknown>, allowed: number[]): void {
  if (!Array.isArray(data.tenants)) return
  const owned = new Set(allowed)
  data.tenants = (data.tenants as TenantEntry[]).filter((entry) => {
    const id = extractTenantId(entry?.tenant)
    return id != null && owned.has(id)
  })
}

/**
 * On user create: stamp registrationTenant from the resolved tenant.
 * Does not invent a tenants[] row. Without registrationTenant, Connect customers
 * fall back to the platform Stripe account and tenant admins cannot find the user.
 */
export async function ensureCreateTenantScope(
  args: EnsureCreateTenantScopeArgs,
): Promise<Record<string, unknown>> {
  const { data, req } = args
  const tenantId = await resolveTenantIdForUserCreate(data, req)
  const actorIsSuperAdmin = Boolean(req.user && isAdmin(req.user))

  if (req.user && !actorIsSuperAdmin) {
    retainOwnedTenantRows(data, getTenantMembershipIdsFromUserDoc(req.user))
  }

  if (tenantId == null) {
    if (req.user && !actorIsSuperAdmin) delete data.registrationTenant
    return data
  }

  if (!req.user || actorIsSuperAdmin) {
    if (data.registrationTenant == null || data.registrationTenant === '') {
      data.registrationTenant = tenantId
    }
  } else {
    data.registrationTenant = tenantId
  }

  return data
}

import type { Access, AccessArgs, Payload, Where } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { cookiesFromHeaders } from '../utilities/cookiesFromHeaders'
import { getPayloadTenantIdFromRequest } from '../utilities/tenantRequest'
import {
  getTenantMembershipIdsFromUserDoc,
  getUserTenantIds,
  loadUserDocForTenantMembership,
} from './tenant-scoped'
import { getDistinctBookingUserIdsForTenants } from './getDistinctBookingUserIdsForTenants'

/** Keep `id in (...)` lists bounded for Postgres / query planners. */
const BOOKING_USER_IDS_IN_CHUNK = 2000

function appendBookingUserOrClauses(
  orClauses: NonNullable<Where['or']>,
  userIdsWithBookings: number[],
): void {
  if (userIdsWithBookings.length === 0) return
  for (let i = 0; i < userIdsWithBookings.length; i += BOOKING_USER_IDS_IN_CHUNK) {
    const chunk = userIdsWithBookings.slice(i, i + BOOKING_USER_IDS_IN_CHUNK)
    if (chunk.length > 0) {
      orClauses.push({ id: { in: chunk } })
    }
  }
}

/** Platform super-admin (full system access). */
export function isAdmin(u: unknown): boolean {
  if (checkRole(['super-admin'], u as SharedUser)) return true
  const role = (u as { role?: string | string[] })?.role
  if (Array.isArray(role) && role.includes('super-admin')) return true
  if (role === 'super-admin') return true
  return false
}

/** Tenant organization admin (former tenant-admin). */
export function isTenantAdmin(u: unknown): boolean {
  if (checkRole(['admin'], u as SharedUser)) return true
  const role = (u as { role?: string | string[] })?.role
  if (Array.isArray(role) && role.includes('admin')) return true
  if (role === 'admin') return true
  return false
}

/** Tenant staff: limited operational access (bookings / attendance). */
export function isStaff(u: unknown): boolean {
  if (checkRole(['staff'], u as SharedUser)) return true
  const role = (u as { role?: string | string[] })?.role
  if (Array.isArray(role) && role.includes('staff')) return true
  if (role === 'staff') return true
  return false
}

/** Tenant-scoped roles that use the tenant selector / cookie rules (org admin or staff). */
export function isTenantPortalUser(u: unknown): boolean {
  return isTenantAdmin(u) || isStaff(u)
}

/**
 * Payload `access.admin`: show the collection in the admin sidebar.
 * Excludes staff-only users (org `admin` / platform `super-admin` only) for a minimal staff dashboard.
 */
export const tenantOrgPayloadAdminAccess = ({ req: { user } }: AccessArgs): boolean => {
  if (!user) return false
  return isAdmin(user) || isTenantAdmin(user)
}

/** Users collection: super-admin, org admin, and staff (minimal roster in admin). */
export const usersPayloadAdminAccess = ({ req: { user } }: AccessArgs): boolean => {
  if (!user) return false
  return isAdmin(user) || isTenantAdmin(user) || isStaff(user)
}

/** Staff role without org `admin` — operational access only (no CMS / schedule configuration). */
export function isStaffOnlyUser(user: unknown): boolean {
  if (!user) return false
  return isStaff(user) && !isTenantAdmin(user)
}

/**
 * Coerce user id to number (session/auth may provide string).
 */
function toUserId(user: unknown): number | null {
  if (user == null) return null
  if (typeof user === 'object' && 'id' in user) {
    const id = (user as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string') {
      const n = parseInt(id, 10)
      return Number.isFinite(n) ? n : null
    }
  }
  if (typeof user === 'number' && Number.isFinite(user)) return user
  return null
}

/**
 * For tenant portal users, req.user may come from the session without the `tenants`
 * relationship populated. Load membership fields only (same query as other hot paths).
 */
async function getTenantPortalUserWithTenants(
  user: unknown,
  payload: Payload,
): Promise<SharedUser | null> {
  const userId = toUserId(user)
  if (userId == null) return null
  const full = await loadUserDocForTenantMembership(payload, userId)
  return full as SharedUser | null
}

/**
 * Resolve the tenant ID from req.context (e.g. selected tenant in admin or subdomain).
 * Returns a number or null if not set / invalid.
 */
function getContextTenantId(req: { context?: { tenant?: unknown } }): number | null {
  const raw = req?.context?.tenant
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string') {
      const n = parseInt(id, 10)
      return Number.isFinite(n) ? n : null
    }
  }
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : null
  }
  return null
}

type TenantScopedReq = {
  context?: { tenant?: unknown }
  cookies?: { get?: (name: string) => { value?: string } | undefined }
  headers?: { get?: (name: string) => string | null }
}

/**
 * When the admin tenant selector sets `payload-tenant` on the platform root host, Payload list
 * requests may omit `req.context.tenant`. Narrow scope to that tenant only if it is one of the
 * portal user's assigned tenants (ignore arbitrary cookie values).
 */
function resolvePortalUserScopedTenantId(req: TenantScopedReq, assignedTenantIds: number[]): number | null {
  const fromContext = getContextTenantId(req)
  if (fromContext != null && assignedTenantIds.includes(fromContext)) {
    return fromContext
  }

  let fromCookie = getPayloadTenantIdFromRequest({
    cookies: req.cookies,
    headers: req.headers as Headers | undefined,
  })
  // Admin list / RSC often omit `req.cookies`; the browser still sends `Cookie`.
  if (fromCookie == null && req.headers && typeof (req.headers as Headers).get === 'function') {
    const headers = req.headers as Headers
    fromCookie = getPayloadTenantIdFromRequest({
      cookies: cookiesFromHeaders(headers),
      headers,
    })
  }
  if (fromCookie != null && assignedTenantIds.includes(fromCookie)) {
    return fromCookie
  }

  return null
}

/**
 * User read access for multi-tenant apps.
 *
 * - Super admin: can read all users (no query filter)
 * - Tenant admin / staff: can only read users for their domain(s) (tenant = domain):
 *   - Users who registered at their domain (registrationTenant in tenant IDs)
 *   - Users who have a booking at their domain
 *   - The tenant portal user themselves
 *   When req.context.tenant or the admin `payload-tenant` cookie selects a tenant, scope to that domain only.
 * - Regular user: can only read themselves
 */
export const userTenantRead: Access = async ({ req }) => {
  const { user, payload } = req
  if (!user) return false

  if (isAdmin(user)) {
    return true
  }

  if (isTenantPortalUser(user)) {
    let tenantIds = getUserTenantIds(user as unknown as SharedUser)
    let fullUser: SharedUser | null = null
    // Session user may not have tenants populated; fetch full user so we can resolve tenant IDs
    if (tenantIds !== null && tenantIds.length === 0) {
      fullUser = await getTenantPortalUserWithTenants(user, payload)
      if (fullUser) {
        tenantIds = getUserTenantIds(fullUser)
        if (tenantIds === null && !isAdmin(user)) {
          tenantIds = getTenantMembershipIdsFromUserDoc(fullUser)
        }
      }
    }
    // Fallback: tenants relation may be empty from join table; use registrationTenant
    if (tenantIds !== null && tenantIds.length === 0) {
      const u = fullUser ?? (await getTenantPortalUserWithTenants(user, payload)) ?? user
      const reg = (u as unknown as { registrationTenant?: number | { id: number } }).registrationTenant
      const tid = typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
      if (typeof tid === 'number') tenantIds = [tid]
    }
    if (tenantIds === null || tenantIds.length === 0) return false

    const assigned = tenantIds
    const scopedTenantId = resolvePortalUserScopedTenantId(req as TenantScopedReq, assigned)
    const effectiveTenantIds = scopedTenantId != null ? [scopedTenantId] : assigned

    const userId = toUserId(user)
    if (userId == null) return false

    const orClauses: NonNullable<Where['or']> = [
      { registrationTenant: { in: effectiveTenantIds } },
      { id: { equals: userId } },
    ]

    const userIdsWithBookings = await getDistinctBookingUserIdsForTenants(
      payload,
      effectiveTenantIds,
      req,
    )
    appendBookingUserOrClauses(orClauses, userIdsWithBookings)

    const where: Where = { or: orClauses }
    return where
  }

  // Regular user: can only read themselves
  const readUserId = toUserId(user)
  if (readUserId == null) return false
  const where: Where = { id: { equals: readUserId } }
  return where
}

/**
 * User update access for multi-tenant apps.
 *
 * - Super admin: can update any user
 * - Tenant admin / staff: can only update users for their domain(s) (same scoping as read)
 * - Regular user: can only update themselves
 */
export const userTenantUpdate: Access = async ({ req, id }) => {
  const { user, payload } = req
  if (!user) return false

  if (isStaffOnlyUser(user)) {
    return false
  }

  if (isAdmin(user)) {
    return true
  }

  if (isTenantPortalUser(user)) {
    let tenantIds = getUserTenantIds(user as unknown as SharedUser)
    let fullUser: SharedUser | null = null
    if (tenantIds !== null && tenantIds.length === 0) {
      fullUser = await getTenantPortalUserWithTenants(user, payload)
      if (fullUser) {
        tenantIds = getUserTenantIds(fullUser)
        if (tenantIds === null && !isAdmin(user)) {
          tenantIds = getTenantMembershipIdsFromUserDoc(fullUser)
        }
      }
    }
    if (tenantIds !== null && tenantIds.length === 0) {
      const u = fullUser ?? (await getTenantPortalUserWithTenants(user, payload)) ?? user
      const reg = (u as unknown as { registrationTenant?: number | { id: number } }).registrationTenant
      const tid = typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
      if (typeof tid === 'number') tenantIds = [tid]
    }
    if (tenantIds === null || tenantIds.length === 0) return false

    const assigned = tenantIds
    const scopedTenantId = resolvePortalUserScopedTenantId(req as TenantScopedReq, assigned)
    const effectiveTenantIds = scopedTenantId != null ? [scopedTenantId] : assigned

    const userId = toUserId(user)
    if (userId == null) return false

    const orClauses: NonNullable<Where['or']> = [
      { registrationTenant: { in: effectiveTenantIds } },
      { id: { equals: userId } },
    ]

    const userIdsWithBookings = await getDistinctBookingUserIdsForTenants(
      payload,
      effectiveTenantIds,
      req,
    )
    appendBookingUserOrClauses(orClauses, userIdsWithBookings)

    const where: Where = { or: orClauses }
    return where
  }

  const updateUserId = toUserId(user)
  if (updateUserId == null) return false
  const targetId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : null
  return targetId != null && targetId === updateUserId
}

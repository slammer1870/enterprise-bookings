import type { Access, AccessArgs, Payload, Where } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { cookiesFromHeaders } from '../utilities/cookiesFromHeaders'
import { getPayloadTenantIdFromRequest, getTenantSlugFromHost } from '../utilities/tenantRequest'
import { isPureLocationManager } from './locationManagerScope'
import {
  getTenantMembershipIdsFromUserDoc,
  getUserTenantIDs,
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

/**
 * Roles on any `tenants[n].roles` row.
 * Authoritative for org roles (`admin` / `staff` / `location-manager` / `user`).
 * Global `role` is only for platform `super-admin` (plus a derived JWT cache via
 * `deriveRoleFromTenants` — never treat that cache as the source of truth here).
 */
function tenantMembershipRoles(u: unknown): string[] {
  if (!u || typeof u !== 'object') return []
  const tenants = (u as { tenants?: unknown }).tenants
  if (!Array.isArray(tenants)) return []
  const out: string[] = []
  for (const entry of tenants) {
    if (!entry || typeof entry !== 'object') continue
    const roles = (entry as { roles?: unknown }).roles
    if (!Array.isArray(roles)) continue
    for (const r of roles) {
      if (typeof r === 'string' && r) out.push(r)
    }
  }
  return out
}

function hasTenantMembershipRole(u: unknown, roleName: string): boolean {
  return tenantMembershipRoles(u).includes(roleName)
}

/** Platform super-admin (full system access). Only global `role` defines this. */
export function isAdmin(u: unknown): boolean {
  if (checkRole(['super-admin'], u as SharedUser)) return true
  const role = (u as { role?: string | string[] })?.role
  if (Array.isArray(role) && role.includes('super-admin')) return true
  if (role === 'super-admin') return true
  return false
}

/** Tenant organization admin — from `tenants[n].roles` only. */
export function isTenantAdmin(u: unknown): boolean {
  return hasTenantMembershipRole(u, 'admin')
}

/** Tenant staff — from `tenants[n].roles` only. */
export function isStaff(u: unknown): boolean {
  return hasTenantMembershipRole(u, 'staff')
}

/** Branch/site manager — from `tenants[n].roles` only. */
export function isLocationManager(u: unknown): boolean {
  return hasTenantMembershipRole(u, 'location-manager')
}

/** Tenant-scoped roles that use the tenant selector / cookie rules (org admin or staff). */
export function isTenantPortalUser(u: unknown): boolean {
  return isTenantAdmin(u) || isStaff(u)
}

/**
 * Derived global `role` may still appear on shallow JWT/session users that omit `tenants`.
 * Never authoritative for org access — only a signal to hydrate memberships from the DB.
 */
function hasDerivedPortalRoleHint(u: unknown): boolean {
  if (checkRole(['admin', 'staff', 'location-manager'], u as SharedUser)) return true
  const role = (u as { role?: string | string[] })?.role
  if (Array.isArray(role)) {
    return role.some((r) => r === 'admin' || r === 'staff' || r === 'location-manager')
  }
  return role === 'admin' || role === 'staff' || role === 'location-manager'
}

function sessionLacksTenantMemberships(u: unknown): boolean {
  const tenants = (u as { tenants?: unknown })?.tenants
  return !Array.isArray(tenants) || tenants.length === 0
}

/**
 * Shallow sessions often have derived global role but no `tenants` array.
 * Load memberships, then apply tenants[n].roles as the source of truth.
 */
async function resolveUserWithTenantMemberships(
  user: unknown,
  payload: Payload,
): Promise<unknown> {
  if (!sessionLacksTenantMemberships(user)) return user
  if (!hasDerivedPortalRoleHint(user)) return user
  const full = await getTenantPortalUserWithTenants(user, payload)
  return full ?? user
}

/**
 * Payload `access.admin`: show the collection in the admin sidebar.
 * Excludes staff-only users (org `admin` / platform `super-admin` only) for a minimal staff dashboard.
 */
export const tenantOrgPayloadAdminAccess = ({ req: { user } }: AccessArgs): boolean => {
  if (!user) return false
  return isAdmin(user) || isTenantAdmin(user)
}

/**
 * Users collection `access.admin` — also the source of `permissions.canAccessAdmin` for the
 * entire Payload admin panel (Payload derives `canAccessAdmin` from this function).
 *
 * On a tenant subdomain the user must hold admin / staff / location-manager specifically
 * for THAT tenant, otherwise they are redirected to /admin/unauthorized.
 * On the base domain any admin-role user is allowed (data isolation is per-collection).
 */
export const usersPayloadAdminAccess = async ({ req }: AccessArgs): Promise<boolean> => {
  const { user } = req
  if (!user) return false

  // Platform super-admins always have full admin panel access.
  if (isAdmin(user)) return true

  const accessUser = await resolveUserWithTenantMemberships(user, req.payload)

  // On the base domain (no tenant subdomain) allow any admin / staff / location-manager.
  const tenantSlug = getTenantSlugFromHost(req.headers)
  if (!tenantSlug) {
    return (
      isTenantAdmin(accessUser) || isStaff(accessUser) || isLocationManager(accessUser)
    )
  }

  // On a tenant subdomain: the user must hold admin / staff / location-manager for THIS
  // specific tenant — otherwise Payload shows /admin/unauthorized.
  const adminTenantIds = getUserTenantIDs(accessUser, ['admin', 'staff', 'location-manager'])
  if (adminTenantIds.length === 0) return false

  try {
    const result = await req.payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenantId = result.docs[0]?.id
    if (!tenantId) return false
    return adminTenantIds.includes(tenantId as number)
  } catch {
    // Fail open if the DB is temporarily unavailable so legitimate admins aren't locked out.
    return (
      isTenantAdmin(accessUser) || isStaff(accessUser) || isLocationManager(accessUser)
    )
  }
}

/**
 * Staff role without org `admin` — operational access only (no CMS / schedule configuration).
 * Prefers `tenants[].roles`; falls back to derived global `role` when memberships are omitted
 * from the session (JWT / shallow admin user).
 */
export function isStaffOnlyUser(user: unknown): boolean {
  if (!user) return false
  if (isAdmin(user) || isTenantAdmin(user)) return false
  if (isStaff(user)) return true
  // Derived global role cache (see deriveRoleFromTenants) — never grant org admin via this path.
  if (checkRole(['staff'], user as SharedUser) && !checkRole(['admin', 'super-admin'], user as SharedUser)) {
    return true
  }
  return false
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

  // Hydrate when session has derived global role but omits `tenants` (Better Auth shallow user).
  const accessUser = await resolveUserWithTenantMemberships(user, payload)

  if (isTenantPortalUser(accessUser)) {
    let tenantIds = getUserTenantIds(accessUser as unknown as SharedUser)
    let fullUser: SharedUser | null =
      accessUser !== user && accessUser && typeof accessUser === 'object'
        ? (accessUser as SharedUser)
        : null
    // Session user may not have tenants populated; fetch full user so we can resolve tenant IDs
    if (tenantIds !== null && tenantIds.length === 0) {
      fullUser = fullUser ?? (await getTenantPortalUserWithTenants(user, payload))
      if (fullUser) {
        tenantIds = getUserTenantIds(fullUser)
        if (tenantIds === null && !isAdmin(user)) {
          tenantIds = getTenantMembershipIdsFromUserDoc(fullUser)
        }
      }
    }
    // Fallback: tenants relation may be empty from join table; use registrationTenant
    if (tenantIds !== null && tenantIds.length === 0) {
      const u = fullUser ?? (await getTenantPortalUserWithTenants(user, payload)) ?? accessUser
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

    // `users_tenants` join: dotted path matches Payload/Drizzle (nested `tenants: { tenant }` does not).
    const orClauses: NonNullable<Where['or']> = [
      { registrationTenant: { in: effectiveTenantIds } },
      { 'tenants.tenant': { in: effectiveTenantIds } } as Where,
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
 * - Tenant admin: can only update users for their domain(s) (same scoping as read)
 * - Staff / pure location-manager: self only (membership/locations stay field-access locked)
 * - Regular user: can only update themselves
 */
export const userTenantUpdate: Access = async ({ req, id }) => {
  const { user, payload } = req
  if (!user) return false

  if (isAdmin(user)) {
    return true
  }

  // Hydrate when session has derived global role but omits `tenants` (Better Auth shallow user).
  const accessUser = await resolveUserWithTenantMemberships(user, payload)

  // Staff and site managers are not tenant-portal updaters of other users, but may edit
  // their own profile. `tenants[]` / locations remain protected by field-level access.
  if (isStaffOnlyUser(accessUser) || isPureLocationManager(accessUser)) {
    const updateUserId = toUserId(user)
    if (updateUserId == null) return false
    const targetId = typeof id === 'number' ? id : typeof id === 'string' ? parseInt(id, 10) : null
    return targetId != null && targetId === updateUserId
  }

  if (isTenantPortalUser(accessUser)) {
    let tenantIds = getUserTenantIds(accessUser as unknown as SharedUser)
    let fullUser: SharedUser | null =
      accessUser !== user && accessUser && typeof accessUser === 'object'
        ? (accessUser as SharedUser)
        : null
    if (tenantIds !== null && tenantIds.length === 0) {
      fullUser = fullUser ?? (await getTenantPortalUserWithTenants(user, payload))
      if (fullUser) {
        tenantIds = getUserTenantIds(fullUser)
        if (tenantIds === null && !isAdmin(user)) {
          tenantIds = getTenantMembershipIdsFromUserDoc(fullUser)
        }
      }
    }
    if (tenantIds !== null && tenantIds.length === 0) {
      const u = fullUser ?? (await getTenantPortalUserWithTenants(user, payload)) ?? accessUser
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

    // `users_tenants` join: dotted path matches Payload/Drizzle (nested `tenants: { tenant }` does not).
    const orClauses: NonNullable<Where['or']> = [
      { registrationTenant: { in: effectiveTenantIds } },
      { 'tenants.tenant': { in: effectiveTenantIds } } as Where,
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

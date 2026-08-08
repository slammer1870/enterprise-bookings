import type { FieldAccess } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'

import { isPureLocationManager } from './locationManagerScope'
import {
  isAdmin,
  isLocationManager,
  isStaffOnlyUser,
  isTenantAdmin,
} from './userTenantAccess'

/**
 * Staff-only and location-managers share the minimal Users roster field policy.
 * Includes derived global `location-manager` when the session omits `tenants[]`.
 */
function isRosterViewer(user: unknown): boolean {
  if (isStaffOnlyUser(user) || isPureLocationManager(user) || isLocationManager(user)) {
    return true
  }
  return (
    checkRole(['location-manager'], user as SharedUser) &&
    !checkRole(['admin', 'super-admin'], user as SharedUser) &&
    !isTenantAdmin(user)
  )
}

/** Location managers manage member accounts — need name/email on create + edit. */
function isLocationManagerManager(user: unknown): boolean {
  if (isLocationManager(user) || isPureLocationManager(user)) return true
  return (
    checkRole(['location-manager'], user as SharedUser) &&
    !checkRole(['admin', 'super-admin'], user as SharedUser) &&
    !isTenantAdmin(user)
  )
}

function docUserId(doc: unknown): number | null {
  if (doc == null || typeof doc !== 'object' || !('id' in doc)) return null
  const id = (doc as { id: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  return null
}

function sessionUserId(user: unknown): number | null {
  if (user == null || typeof user !== 'object' || !('id' in user)) return null
  const id = (user as { id: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  return null
}

type FieldAccessArgs = {
  doc?: unknown
  data?: unknown
  siblingData?: unknown
  req: { user?: unknown }
}

function resolveTargetId(args: FieldAccessArgs): number | null {
  return docUserId(args.doc) ?? docUserId(args.data) ?? docUserId(args.siblingData)
}

/**
 * Names, emails, roles, auth secrets, billing, and tenant membership — hidden from staff
 * when viewing someone other than themselves (minimal roster).
 */
export const STAFF_ROSTER_SENSITIVE_FIELD_NAMES = new Set([
  'email',
  'emailVerified',
  'image',
  'role',
  'banned',
  'banReason',
  'banExpires',
  'registrationTenant',
  'tenants',
  'stripeCustomerId',
  'stripeCustomers',
  // userSubscription intentionally readable by tenant admins (not staff-only).
  // Staff-only still blocked via userSensitiveFieldReadForStaffRoster.
  'userSubscription',
  'account',
  'session',
  'sessions',
  'resetPasswordToken',
  'resetPasswordExpiration',
  'salt',
  'hash',
  'loginAttempts',
  'lockUntil',
])

/** Display name: staff / location-managers can read for all users visible via collection read (roster). */
export const userNameFieldReadForStaffRoster: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u) || isRosterViewer(u)) return true
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  return uid != null && did != null && uid === did
}

/** Name create/update: location-managers (and org admins) can set name when creating/editing members. */
export const userNameFieldWriteForStaffRoster: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u) || isLocationManagerManager(u)) return true
  if (isStaffOnlyUser(u)) {
    const did = resolveTargetId(a)
    if (did == null) return true // create
    const uid = sessionUserId(u)
    return uid != null && uid === did
  }
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  return uid != null && did != null && uid === did
}

/**
 * Sensitive fields: org admins + super-admin see all; staff only on own row.
 * Location-managers may read/write `email` (member management); other sensitive fields stay locked.
 */
export const userSensitiveFieldReadForStaffRoster: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u)) return true
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  if (uid != null && did != null && uid === did) return true
  if (isRosterViewer(u)) return false
  return uid != null && did != null && uid === did
}

/** Email read for location-managers managing members (other sensitive fields use the stricter reader). */
export const userEmailFieldReadForLocationManager: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u) || isLocationManagerManager(u)) return true
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  if (uid != null && did != null && uid === did) return true
  if (isStaffOnlyUser(u)) return false
  return uid != null && did != null && uid === did
}

export const userEmailFieldWriteForLocationManager: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u) || isLocationManagerManager(u)) return true
  if (isStaffOnlyUser(u)) {
    const did = resolveTargetId(a)
    if (did == null) return true
    const uid = sessionUserId(u)
    return uid != null && uid === did
  }
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  return uid != null && did != null && uid === did
}

/** createdAt / updatedAt: staff / location-managers can read for roster context. */
export const userTimestampFieldReadForStaffRoster: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u) || isRosterViewer(u)) return true
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  return uid != null && did != null && uid === did
}

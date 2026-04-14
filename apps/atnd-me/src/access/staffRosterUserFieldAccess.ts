import type { FieldAccess } from 'payload'

import { isAdmin, isStaffOnlyUser, isTenantAdmin } from './userTenantAccess'

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

/** Display name: staff can read for all users visible via collection read (roster). */
export const userNameFieldReadForStaffRoster: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u) || isStaffOnlyUser(u)) return true
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  return uid != null && did != null && uid === did
}

/** Sensitive fields: org admins + super-admin see all; staff only on own row; others self-only. */
export const userSensitiveFieldReadForStaffRoster: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u)) return true
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  if (uid != null && did != null && uid === did) return true
  if (isStaffOnlyUser(u)) return false
  return uid != null && did != null && uid === did
}

/** createdAt / updatedAt: staff can read for roster context. */
export const userTimestampFieldReadForStaffRoster: FieldAccess = (args) => {
  const a = args as FieldAccessArgs
  const u = a.req.user
  if (!u) return false
  if (isAdmin(u) || isTenantAdmin(u) || isStaffOnlyUser(u)) return true
  const uid = sessionUserId(u)
  const did = resolveTargetId(a)
  return uid != null && did != null && uid === did
}

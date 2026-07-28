/**
 * Explicit opt-in for Local API / system user writes that must set `tenants[].roles`
 * (guest checkout, onboarding claim). Prefer this over allowing all unauthenticated field access.
 *
 * Callers must declare which per-tenant / global role values they are allowed to write.
 * `beforeChange` clamps submitted roles to that allow-list.
 */
export const ATND_SYSTEM_USER_WRITE_CTX = '__atndSystemUserWrite' as const
export const ATND_SYSTEM_USER_WRITE_ALLOWED_ROLES_CTX =
  '__atndSystemUserWriteAllowedRoles' as const

export const TENANT_MEMBERSHIP_ROLE_VALUES = [
  'user',
  'admin',
  'staff',
  'location-manager',
] as const

export type TenantMembershipRole = (typeof TENANT_MEMBERSHIP_ROLE_VALUES)[number]

export function systemUserWriteContext(opts?: {
  /** Roles this system write may set on `tenants[].roles` / global `role`. Default: `['user']`. */
  allowedRoles?: readonly TenantMembershipRole[]
  extra?: Record<string, unknown>
}): Record<string, unknown> {
  const allowedRoles = opts?.allowedRoles?.length
    ? [...opts.allowedRoles]
    : (['user'] satisfies TenantMembershipRole[])

  return {
    ...(opts?.extra ?? {}),
    [ATND_SYSTEM_USER_WRITE_CTX]: true,
    [ATND_SYSTEM_USER_WRITE_ALLOWED_ROLES_CTX]: allowedRoles,
  }
}

export function isSystemUserWrite(req: {
  context?: Record<string, unknown> | null
} | null | undefined): boolean {
  return req?.context?.[ATND_SYSTEM_USER_WRITE_CTX] === true
}

export function getSystemUserWriteAllowedRoles(req: {
  context?: Record<string, unknown> | null
} | null | undefined): TenantMembershipRole[] {
  if (!isSystemUserWrite(req)) return ['user']
  const raw = req?.context?.[ATND_SYSTEM_USER_WRITE_ALLOWED_ROLES_CTX]
  if (!Array.isArray(raw) || raw.length === 0) return ['user']
  const allowed = new Set<string>(TENANT_MEMBERSHIP_ROLE_VALUES)
  const filtered = raw.filter(
    (r): r is TenantMembershipRole => typeof r === 'string' && allowed.has(r),
  )
  return filtered.length > 0 ? filtered : ['user']
}

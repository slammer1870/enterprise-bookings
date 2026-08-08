/**
 * Client-safe role checks for Better Auth `role` (and legacy `roles` during migration).
 * Use in admin UI components; use @/access/userTenantAccess in API routes.
 */
type MaybeRoleObj = { role?: unknown; value?: unknown }

function extractRoles(user: unknown): string[] {
  if (!user || typeof user !== 'object') return []
  const u = user as { roles?: unknown; role?: unknown }

  const out: string[] = []

  const pushOne = (r: unknown) => {
    if (typeof r === 'string' && r) out.push(r)
  }

  const pushMany = (value: unknown) => {
    if (!value) return
    if (typeof value === 'string') return pushOne(value)
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') {
          pushOne(entry)
        } else if (entry && typeof entry === 'object') {
          const obj = entry as MaybeRoleObj
          pushOne(obj.role)
          pushOne(obj.value)
        }
      }
    } else if (value && typeof value === 'object') {
      const obj = value as MaybeRoleObj
      pushOne(obj.role)
      pushOne(obj.value)
    }
  }

  pushMany(u.roles)
  pushMany(u.role)

  return out
}

/**
 * Roles on any `tenants[n].roles` row.
 * Authoritative for org roles; global `role` is only for platform `super-admin`.
 */
function extractTenantMembershipRoles(user: unknown): string[] {
  if (!user || typeof user !== 'object') return []
  const tenants = (user as { tenants?: unknown }).tenants
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

/** Tenant organization admin — from `tenants[n].roles` only. */
export function isTenantAdmin(user: unknown): boolean {
  return extractTenantMembershipRoles(user).includes('admin')
}

/** Platform super-admin — global `role` only. */
export function isAdmin(user: unknown): boolean {
  return extractRoles(user).includes('super-admin')
}

/** Tenant staff — from `tenants[n].roles` only. */
export function isStaff(user: unknown): boolean {
  return extractTenantMembershipRoles(user).includes('staff')
}

/**
 * Staff without org admin — operational admin UI only.
 * Prefers `tenants[].roles`; falls back to derived global `role` when the client
 * session omits membership rows (common in Payload admin `useAuth`).
 */
export function isStaffOnlyUser(user: unknown): boolean {
  if (!user) return false
  if (isAdmin(user) || isTenantAdmin(user)) return false
  if (isStaff(user)) return true
  const roles = extractRoles(user)
  return roles.includes('staff') && !roles.includes('admin') && !roles.includes('super-admin')
}

/**
 * Client-safe role checks that support both Payload `roles` and Better Auth `role`.
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

/** Tenant organization admin (Payload role `admin`). */
export function isTenantAdmin(user: unknown): boolean {
  return extractRoles(user).includes('admin')
}

/** Platform super-admin. */
export function isAdmin(user: unknown): boolean {
  return extractRoles(user).includes('super-admin')
}

export function isStaff(user: unknown): boolean {
  return extractRoles(user).includes('staff')
}

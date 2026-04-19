/**
 * Slim Better Auth / Payload auth session for app boundaries.
 * Raw `betterAuth.api.getSession` returns a fully populated Payload user (depth + joins).
 */
export type SanitizedBetterAuthUser = {
  id: string
  name: string | null
  email: string | null
  roles: string[]
  /** Same as `roles` — Payload access often reads `user.role` (Better Auth field name). */
  role: string[]
  registrationTenantId: number | null
}

export type SanitizedBetterAuthSession = {
  session: {
    id: string | null
    expiresAt: string | null
  }
  user: SanitizedBetterAuthUser
}

function toId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/** Shrink a Payload / Better Auth user document to a safe, stable shape (no joins / relations). */
export function sanitizeBetterAuthUser(u: unknown): SanitizedBetterAuthUser | null {
  if (!u || typeof u !== 'object') return null
  const o = u as Record<string, unknown>
  const id = toId(o.id)
  if (!id) return null

  const roles = Array.isArray(o.roles)
    ? (o.roles as unknown[]).filter((x): x is string => typeof x === 'string')
    : Array.isArray(o.role)
      ? (o.role as unknown[]).filter((x): x is string => typeof x === 'string')
      : []

  let registrationTenantId: number | null = null
  if (typeof o.registrationTenant === 'number') {
    registrationTenantId = o.registrationTenant
  } else if (o.registrationTenant && typeof o.registrationTenant === 'object') {
    const t = o.registrationTenant as { id?: unknown }
    if (typeof t.id === 'number') registrationTenantId = t.id
    else if (typeof t.id === 'string') {
      const n = parseInt(t.id, 10)
      registrationTenantId = Number.isNaN(n) ? null : n
    }
  }

  return {
    id,
    name: typeof o.name === 'string' ? o.name : null,
    email: typeof o.email === 'string' ? o.email : null,
    roles,
    role: roles,
    registrationTenantId,
  }
}

/**
 * Map raw Better Auth `getSession` or Payload `auth()` output to a small, safe shape
 * (no session token, no nested relations).
 */
export function sanitizeBetterAuthSession(raw: unknown): SanitizedBetterAuthSession | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const user = sanitizeBetterAuthUser(s.user)
  if (!user) return null

  const nested =
    s.session && typeof s.session === 'object' ? (s.session as Record<string, unknown>) : null
  const sessionId = nested ? toId(nested.id) : null
  const expiresAtNested = nested && typeof nested.expiresAt === 'string' ? nested.expiresAt : null
  const expiresAtTop = typeof s.expiresAt === 'string' ? s.expiresAt : null

  return {
    session: {
      id: sessionId ?? toId(s.id),
      expiresAt: expiresAtNested ?? expiresAtTop,
    },
    user,
  }
}

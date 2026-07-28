import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'

import {
  getSystemUserWriteAllowedRoles,
  isSystemUserWrite,
  type TenantMembershipRole,
} from '@/lib/auth/systemUserWriteContext'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'

const ELEVATED_GLOBAL_ROLES = new Set(['super-admin', 'admin', 'staff', 'location-manager'])

function clientIpFromReq(req: PayloadRequest): string {
  const headers = req.headers
  if (headers && typeof headers.get === 'function') {
    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (forwarded) return forwarded
    const realIp = headers.get('x-real-ip')?.trim()
    if (realIp) return realIp
  }
  return 'unknown'
}

function clampRolesToAllowList(
  roles: unknown,
  allowed: ReadonlySet<string>,
  fallback: TenantMembershipRole,
): string[] {
  const raw = Array.isArray(roles) ? roles : roles != null ? [roles] : []
  const values = raw
    .map((r) => {
      if (typeof r === 'string') return r
      if (r && typeof r === 'object' && 'value' in r) {
        const v = (r as { value: unknown }).value
        return typeof v === 'string' ? v : null
      }
      return null
    })
    .filter((v): v is string => typeof v === 'string' && allowed.has(v))
  return values.length > 0 ? values : [fallback]
}

/**
 * Sanitize user writes:
 * - System Local API: clamp roles to the caller's declared allow-list
 * - Anonymous: drop `tenants`, force global role to `['user']`
 */
export function sanitizeUserTenantsAndRolesForWrite(args: {
  data: Record<string, unknown>
  req: PayloadRequest
}): Record<string, unknown> {
  const { data, req } = args

  if (isSystemUserWrite(req)) {
    const allowedList = getSystemUserWriteAllowedRoles(req)
    const allowed = new Set<string>(allowedList)
    const fallback: TenantMembershipRole = allowed.has('user')
      ? 'user'
      : (allowedList[0] ?? 'user')

    const tenants = data.tenants
    if (Array.isArray(tenants)) {
      data.tenants = tenants.map((entry) => {
        if (!entry || typeof entry !== 'object') return entry
        const row = entry as Record<string, unknown>
        return {
          ...row,
          roles: clampRolesToAllowList(row.roles, allowed, fallback),
        }
      })
    }

    if (data.role !== undefined) {
      // Global role may include super-admin only when the allow-list is unused for that;
      // system writers never grant super-admin via this path.
      const globalAllowed = new Set<string>([...allowed])
      data.role = clampRolesToAllowList(data.role, globalAllowed, fallback)
    }

    return data
  }

  if (req.user) return data

  // Anonymous HTTP / untrusted Local API: never accept client-supplied memberships.
  delete data.tenants

  if (data.role !== undefined) {
    const arr = (Array.isArray(data.role) ? data.role : [data.role]).filter(
      (r): r is string => typeof r === 'string' && !ELEVATED_GLOBAL_ROLES.has(r),
    )
    data.role = arr.includes('user') ? ['user'] : arr.length > 0 ? arr : ['user']
  } else {
    data.role = ['user']
  }

  return data
}

/** Rate-limit anonymous user creates (public REST / spam). */
export function assertAnonymousUserCreateRateLimit(req: PayloadRequest): void {
  if (req.user || isSystemUserWrite(req)) return

  const ip = clientIpFromReq(req)
  const result = checkRateLimit({
    key: `users-create:ip:${ip}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!result.allowed) {
    throw new APIError('Too many requests. Please try again later.', 429)
  }
}

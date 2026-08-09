import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'

import {
  getSystemUserWriteAllowedRoles,
  isSystemUserWrite,
  type TenantMembershipRole,
} from '@/lib/auth/systemUserWriteContext'
import { checkRateLimit } from '@/lib/onboarding/rateLimit'

const ELEVATED_GLOBAL_ROLES = new Set(['super-admin', 'admin', 'staff', 'location-manager'])

const ALLOWED_TENANT_ROLES = new Set<string>([
  'admin',
  'staff',
  'location-manager',
  'user',
])

/**
 * Normalize `tenants[n].roles` for Payload hasMany select.
 * Coerces `{ value }` objects, drops unknowns/duplicates, and never returns empty
 * (required select fails with "Tenants N > Roles" otherwise).
 */
export function normalizeTenantRoles(roles: unknown): string[] {
  if (!Array.isArray(roles) || roles.length === 0) return ['user']
  const values = roles
    .map((r) => {
      if (typeof r === 'string') return r
      if (r && typeof r === 'object' && 'value' in r) {
        const v = (r as { value: unknown }).value
        return typeof v === 'string' ? v : null
      }
      return null
    })
    .filter((v): v is string => typeof v === 'string' && ALLOWED_TENANT_ROLES.has(v))
  const unique = [...new Set(values)]
  return unique.length > 0 ? unique : ['user']
}

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
  const unique = [...new Set(values)]
  return unique.length > 0 ? unique : [fallback]
}

/** Public HTTP APIs — Local API is trusted server-side (seeds, int tests, scripts). */
function isPublicHttpApi(req: PayloadRequest): boolean {
  return req.payloadAPI === 'REST' || req.payloadAPI === 'GraphQL'
}

/**
 * Sanitize user writes:
 * - System Local API: clamp roles to the caller's declared allow-list
 * - Anonymous public HTTP create: drop `tenants`, force global role to `['user']`
 * - Anonymous public HTTP update: lock `tenants` / `role` to `originalDoc` so
 *   clients cannot escalate, and forgot-password / token updates cannot wipe
 *   memberships that field hooks merged into `data`
 * - Trusted Local API (no user / no system flag): leave data alone — callers own auth
 */
export function sanitizeUserTenantsAndRolesForWrite(args: {
  data: Record<string, unknown>
  req: PayloadRequest
  operation?: 'create' | 'update' | string
  originalDoc?: Record<string, unknown> | null
}): Record<string, unknown> {
  const { data, req, operation, originalDoc } = args

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

  // Trusted Local API (int tests, seeds, scripts): do not strip memberships.
  if (!isPublicHttpApi(req)) return data

  // Anonymous public HTTP updates (forgot-password token write, etc.):
  // Field beforeValidate merges originalDoc into `data`, so a naive `delete data.tenants`
  // would persist an empty membership list. Lock memberships/roles to the original doc
  // instead — anonymous clients can neither escalate nor strip them.
  if (operation === 'update') {
    if (originalDoc) {
      if ('tenants' in originalDoc) {
        data.tenants = originalDoc.tenants
      } else {
        delete data.tenants
      }
      if ('role' in originalDoc) {
        data.role = originalDoc.role
      } else {
        delete data.role
      }
    } else {
      delete data.tenants
      delete data.role
    }
    return data
  }

  // Anonymous public HTTP create: never accept client-supplied memberships.
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

/** Rate-limit anonymous user creates on public HTTP APIs only (spam). */
export function assertAnonymousUserCreateRateLimit(req: PayloadRequest): void {
  if (req.user || isSystemUserWrite(req) || !isPublicHttpApi(req)) return

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

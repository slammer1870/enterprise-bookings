import type { Access, PayloadRequest, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'
import {
  tenantScopedPublicReadStrict,
  resolveTenantAdminReadConstraint,
  resolveTenantAdminTenantIds,
  getUserTenantIDs,
  loadUserDocForTenantMembership,
} from './tenant-scoped'
import {
  getPayloadLocationIdFromRequest,
  getPayloadTenantIdFromRequest,
} from '@/utilities/tenantRequest'
import { cookiesFromHeaders } from '../utilities/cookiesFromHeaders'
import {
  isPureLocationManager,
  resolveBranchAssignmentScope,
} from '@/access/locationManagerScope'

/** Prefix for per-(tenant,branch) cache entries on `req.context`. */
const PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN_PREFIX = 'PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN'
const PAYLOAD_CTX_CACHED_TIMESLOTS_READ_LM_PREFIX = 'PAYLOAD_CTX_CACHED_TIMESLOTS_READ_LM'
/** Must match `@repo/trpc` `PAYLOAD_CTX_SKIP_ADMIN_BRANCH_FILTER`. */
const PAYLOAD_CTX_SKIP_ADMIN_BRANCH_FILTER = 'skipAdminBranchFilter'

function shouldApplyAdminBranchFilter(req: PayloadRequest): boolean {
  const ctx = req.context as Record<string, unknown> | undefined
  return ctx?.[PAYLOAD_CTX_SKIP_ADMIN_BRANCH_FILTER] !== true
}

function normalizeContextTenantId(contextTenant: unknown): number | null {
  if (typeof contextTenant === 'number' && Number.isFinite(contextTenant)) return contextTenant
  if (typeof contextTenant === 'string' && /^\d+$/.test(contextTenant)) return parseInt(contextTenant, 10)
  if (typeof contextTenant === 'object' && contextTenant !== null && 'id' in contextTenant) {
    const id = (contextTenant as { id?: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

/** Public booking reads reconcile `context.tenant` from host/timeslot; scope reads to that tenant. */
function whereForPublicBookingTenant(context: Record<string, unknown> | undefined): Where | null {
  const tenantId = normalizeContextTenantId(context?.tenant)
  if (tenantId == null) return null
  return { tenant: { equals: tenantId } } as Where
}

function tenantAdminCookieSource(req: PayloadRequest): { cookies?: { get: (name: string) => { value?: string } | undefined } } {
  const typedReq = req as PayloadRequest & {
    cookies?: { get: (name: string) => { value?: string } | undefined }
    headers?: Headers
  }

  // Some routes (notably Next.js tRPC entrypoints and Payload local API calls) may not populate
  // `req.cookies`, so fall back to parsing the `Cookie` header.
  if (typedReq.cookies) {
    return { cookies: typedReq.cookies }
  }

  if (typedReq.headers) {
    const headersAny = typedReq.headers as any
    const cookieHeader =
      typeof headersAny?.get === 'function'
        ? headersAny.get('cookie')
        : typeof headersAny?.cookie === 'string'
          ? headersAny.cookie
          : undefined

    if (typeof cookieHeader === 'string') {
      // Minimal `Cookie` parser; returns a Payload-compatible cookie store.
      const map = new Map<string, string>()
      for (const segment of cookieHeader.split(';')) {
        const trimmed = segment.trim()
        if (!trimmed) continue
        const eq = trimmed.indexOf('=')
        const name = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim()
        const value = eq === -1 ? '' : trimmed.slice(eq + 1).trim()
        if (!name) continue
        map.set(name, value)
      }

      return {
        cookies: {
          get: (name: string) => {
            const v = map.get(name)
            return v !== undefined ? { value: v } : undefined
          },
        },
      }
    }

    // Last resort: if `req.headers` is a real `Headers` instance, use shared parser.
    return { cookies: cookiesFromHeaders(typedReq.headers) }
  }

  return { cookies: undefined }
}

function relationIdFromLocationTenant(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  }
  return null
}

function toUserId(user: unknown): number | null {
  if (user == null || typeof user !== 'object' || !('id' in user)) return null
  const id = (user as { id: unknown }).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10)
  return null
}

/**
 * Fallback tenant scope for org admins/staff. Prefer this over `false` when sidebar
 * cookies are stale/invalid — Payload treats collection `read: false` as "hide from nav".
 */
function whereForTenantMembership(tenantIds: number[]): Where | false {
  if (!tenantIds.length) return false
  if (tenantIds.length === 1) {
    return { tenant: { equals: tenantIds[0]! } } as Where
  }
  return { tenant: { in: tenantIds } } as Where
}

/**
 * When Payload admin sets `payload-location`, constrain timeslots to that branch only if
 * the location row belongs to the selected `payload-tenant` (blocks cookie tampering).
 *
 * Invalid/stale cookies must NOT return `false` when the user still has tenant membership —
 * that removes Timeslots from the Bookings nav group. Fall back to tenant-scoped read instead.
 */
async function whereForSelectedTenantAndOptionalBranch(args: {
  payload: PayloadRequest['payload']
  user: SharedUser
  context: Record<string, unknown> | undefined
  selectedTenantId: number | null
  selectedBranchId: number | null
}): Promise<Where | false> {
  const { payload, user, context, selectedTenantId, selectedBranchId } = args

  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload,
    context,
  })
  if (!tenantIds.length) return false

  const membershipFallback = whereForTenantMembership(tenantIds)

  let tenantIdToUse = selectedTenantId
  if (tenantIdToUse == null) {
    // Base/root admin pages may only have `payload-location`. Derive the tenant from the
    // selected location and still enforce tenant membership (prevents cookie tampering).
    if (selectedBranchId == null) return membershipFallback
    const location = await payload
      .findByID({
        collection: 'locations',
        id: selectedBranchId,
        depth: 0,
        overrideAccess: true,
      })
      .catch(() => null)
    if (!location) return membershipFallback
    const locTenantId = relationIdFromLocationTenant(location.tenant)
    if (locTenantId == null || !tenantIds.includes(locTenantId)) return membershipFallback
    tenantIdToUse = locTenantId
  } else if (!tenantIds.includes(tenantIdToUse)) {
    // Stale payload-tenant for another org — keep collection visible, scope to real membership.
    return membershipFallback
  }

  if (selectedBranchId == null) {
    return { tenant: { equals: tenantIdToUse } } as Where
  }

  const location = await payload
    .findByID({
      collection: 'locations',
      id: selectedBranchId,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)

  if (!location) {
    return { tenant: { equals: tenantIdToUse } } as Where
  }

  const locTenantId = relationIdFromLocationTenant(location.tenant)
  if (locTenantId !== tenantIdToUse) {
    // Tampered/stale location for another tenant: ignore branch, keep selected tenant scope.
    return { tenant: { equals: tenantIdToUse } } as Where
  }

  // Implicit AND on `tenant` + `branch` (same as a single `{ and: [...] }` for Payload).
  return {
    tenant: { equals: tenantIdToUse },
    branch: { equals: selectedBranchId },
  } as Where
}

/**
 * Staff / location-manager with `tenants[].locations` assignments: always limited to those
 * branches; `payload-tenant` / `payload-location` must stay within membership + assignment
 * (cookie cannot widen scope). Unrestricted callers (empty assignment / admin row) fall through
 * to normal tenant + optional branch cookie filtering.
 */
async function whereForBranchAssignedTimeslots(req: PayloadRequest): Promise<Where | false> {
  const user = req.user as unknown as SharedUser
  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload: req.payload,
    context: req.context as Record<string, unknown> | undefined,
  })
  if (!tenantIds.length) return false

  const scopeAll = await resolveBranchAssignmentScope({
    payload: req.payload,
    user,
    tenantIds,
  })

  const cookieSrc = tenantAdminCookieSource(req)
  const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
  const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)

  if (scopeAll.kind === 'unrestricted') {
    if (selectedTenantId != null) {
      if (!tenantIds.includes(selectedTenantId)) {
        // Stale tenant cookie — keep nav visible with membership scope.
        return resolveTenantAdminReadConstraint({ req: req as any })
      }
      if (selectedBranchId != null) {
        return {
          tenant: { equals: selectedTenantId },
          branch: { equals: selectedBranchId },
        } as Where
      }
      return { tenant: { equals: selectedTenantId } } as Where
    }
    return resolveTenantAdminReadConstraint({ req: req as any })
  }

  if (!scopeAll.ids.length) return false

  const assignedFallback = {
    and: [{ tenant: { in: tenantIds } }, { branch: { in: scopeAll.ids } }],
  } as Where

  if (selectedTenantId != null) {
    if (!tenantIds.includes(selectedTenantId)) return assignedFallback

    const tenantScope = await resolveBranchAssignmentScope({
      payload: req.payload,
      user,
      tenantIds: [selectedTenantId],
    })
    if (tenantScope.kind === 'unrestricted') {
      if (selectedBranchId != null) {
        return {
          tenant: { equals: selectedTenantId },
          branch: { equals: selectedBranchId },
        } as Where
      }
      return { tenant: { equals: selectedTenantId } } as Where
    }
    const branchesInTenant = tenantScope.ids
    if (!branchesInTenant.length) return assignedFallback

    if (selectedBranchId != null) {
      if (!branchesInTenant.includes(selectedBranchId)) {
        // Stale/out-of-scope location cookie — ignore it, keep assigned branches.
        return {
          tenant: { equals: selectedTenantId },
          branch: { in: branchesInTenant },
        } as Where
      }
      return {
        tenant: { equals: selectedTenantId },
        branch: { equals: selectedBranchId },
      } as Where
    }

    return {
      tenant: { equals: selectedTenantId },
      branch: { in: branchesInTenant },
    } as Where
  }

  const base = await resolveTenantAdminReadConstraint({ req: req as any })
  if (base === false) return assignedFallback
  return {
    and: [base as Where, { branch: { in: scopeAll.ids } }],
  } as Where
}

/**
 * Timeslots read access:
 * - Super-admin: full access
 * - Tenant-admin / unrestricted staff: tenant scoping; when admin cookies set `payload-tenant` and
 *   optionally `payload-location`, list queries are scoped to that branch (location must
 *   belong to the selected tenant).
 * - Staff / location-manager with `tenants[].locations` assignments: tenant + assigned branches
 *   only (cookie cannot widen scope).
 * - Regular users/public: tenantScopedPublicReadStrict + inactive hidden for anonymous
 *
 * NOTE: We intentionally do NOT filter by endTime here. The rule is
 * "users can see all of today's timeslots (even after they end) but not
 * yesterday's timeslots or earlier". That boundary is date- and timezone-
 * dependent; the getByDate tRPC router handles it correctly using the
 * tenant's timezone. Filtering by `endTime >= now` here would incorrectly
 * hide timeslots that started earlier today, breaking the full-day schedule view.
 */
export const timeslotsRead: Access = async (args) => {
  const user = args.req.user as unknown as SharedUser | undefined | null

  if (user && checkRole(['super-admin'], user as any)) {
    // When the admin has set a branch/tenant cookie via the sidebar selector, honour it so the
    // timeslots list filters correctly (same UX as tenant-admin). Super-admins can trust any
    // tenant or branch (no membership check needed), so we build the Where clause directly.
    const cookieSrc = tenantAdminCookieSource(args.req)
    const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
    const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)

    if (selectedBranchId != null) {
      const constraint: Where = { branch: { equals: selectedBranchId } }
      return selectedTenantId != null
        ? ({ and: [{ tenant: { equals: selectedTenantId } }, constraint] } as Where)
        : constraint
    }

    if (selectedTenantId != null) {
      return { tenant: { equals: selectedTenantId } } as Where
    }

    return true
  }

  if (user && checkRole(['admin', 'staff'], user as any)) {
    const ctx = (args.req.context ??= {}) as Record<string, unknown>
    const cookieSrc = tenantAdminCookieSource(args.req)
    const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
    const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)
    const uid = toUserId(user) ?? 0
    const cacheKey = shouldApplyAdminBranchFilter(args.req)
      ? `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN_PREFIX}:${uid}:${selectedTenantId ?? 'none'}:${selectedBranchId ?? 'all'}`
      : `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN_PREFIX}:public-booking:${normalizeContextTenantId(ctx.tenant) ?? 'none'}`

    const cached = ctx[cacheKey]
    if (cached !== undefined) {
      return cached as unknown as boolean | Where
    }

    const constraint = await (async () => {
      if (!shouldApplyAdminBranchFilter(args.req)) {
        const publicBookingWhere = whereForPublicBookingTenant(ctx)
        if (publicBookingWhere) return publicBookingWhere
        return resolveTenantAdminReadConstraint({ req: args.req as any })
      }

      // Staff (and dual-role users) with non-empty `tenants[].locations` must not widen
      // via payload-location / "all sites" beyond their assignment.
      const membershipTenantIds = await resolveTenantAdminTenantIds({
        user,
        payload: args.req.payload,
        context: args.req.context as Record<string, unknown> | undefined,
      })
      const scopeTenantIds =
        selectedTenantId != null && membershipTenantIds.includes(selectedTenantId)
          ? [selectedTenantId]
          : membershipTenantIds
      if (scopeTenantIds.length) {
        const branchScope = await resolveBranchAssignmentScope({
          payload: args.req.payload,
          user,
          tenantIds: scopeTenantIds,
        })
        if (branchScope.kind === 'ids') {
          return whereForBranchAssignedTimeslots(args.req)
        }
      }

      if (selectedTenantId != null || selectedBranchId != null) {
        return whereForSelectedTenantAndOptionalBranch({
          payload: args.req.payload,
          user,
          context: args.req.context as Record<string, unknown> | undefined,
          selectedTenantId,
          selectedBranchId,
        })
      }

      const publicBookingWhere = whereForPublicBookingTenant(ctx)
      if (publicBookingWhere) {
        return publicBookingWhere
      }

      return resolveTenantAdminReadConstraint({ req: args.req as any })
    })()

    ctx[cacheKey] = constraint
    return constraint as unknown as boolean | Where
  }

  if (user && isPureLocationManager(user)) {
    const ctx = (args.req.context ??= {}) as Record<string, unknown>
    const cookieSrc = tenantAdminCookieSource(args.req)
    const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
    const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)
    const uid = toUserId(user) ?? 0
    const branchScopeKey = shouldApplyAdminBranchFilter(args.req)
      ? `${selectedTenantId ?? 'none'}:${selectedBranchId ?? 'all'}`
      : 'public-booking'
    const cacheKey = `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_LM_PREFIX}:${uid}:${branchScopeKey}`

    const cachedLm = ctx[cacheKey]
    if (cachedLm !== undefined) {
      return cachedLm as unknown as boolean | Where
    }

    const lmConstraint = shouldApplyAdminBranchFilter(args.req)
      ? await whereForBranchAssignedTimeslots(args.req)
      : whereForPublicBookingTenant(args.req.context as Record<string, unknown> | undefined) ??
        (await resolveTenantAdminReadConstraint({ req: args.req as any }))
    ctx[cacheKey] = lmConstraint
    return lmConstraint as unknown as boolean | Where
  }

  // JWT/session may omit global `role` while `tenants[n].roles` still has admin/staff/LM.
  // Without this, checkRole fails above and we fall through to public read → `false` on
  // the admin panel (no host tenant) → Timeslots disappears from the Bookings nav.
  if (user) {
    const uid = toUserId(user)
    if (uid != null) {
      const fullUser = await loadUserDocForTenantMembership(args.req.payload, uid)
      if (fullUser) {
        const adminStaffTenants = getUserTenantIDs(fullUser, ['admin', 'staff'])
        const lmTenants = getUserTenantIDs(fullUser, ['location-manager'])
        const elevatedUser = fullUser as unknown as SharedUser

        if (lmTenants.length > 0 && adminStaffTenants.length === 0) {
          // Pure LM via tenants[].roles only — keep branch assignment scope.
          const ctx = (args.req.context ??= {}) as Record<string, unknown>
          const cookieSrc = tenantAdminCookieSource(args.req)
          const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
          const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)
          const cacheKey = `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_LM_PREFIX}:elevated:${uid}:${selectedTenantId ?? 'none'}:${selectedBranchId ?? 'all'}`
          const cachedLm = ctx[cacheKey]
          if (cachedLm !== undefined) {
            return cachedLm as unknown as boolean | Where
          }
          const prevUser = args.req.user
          args.req.user = elevatedUser as typeof args.req.user
          try {
            const lmConstraint = shouldApplyAdminBranchFilter(args.req)
              ? await whereForBranchAssignedTimeslots(args.req)
              : whereForPublicBookingTenant(ctx) ??
                (await resolveTenantAdminReadConstraint({ req: args.req as any }))
            ctx[cacheKey] = lmConstraint
            return lmConstraint as unknown as boolean | Where
          } finally {
            args.req.user = prevUser
          }
        }

        if (adminStaffTenants.length > 0) {
          const ctx = (args.req.context ??= {}) as Record<string, unknown>
          const cookieSrc = tenantAdminCookieSource(args.req)
          const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
          const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)
          const cacheKey = shouldApplyAdminBranchFilter(args.req)
            ? `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN_PREFIX}:elevated:${uid}:${selectedTenantId ?? 'none'}:${selectedBranchId ?? 'all'}`
            : `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN_PREFIX}:elevated:public-booking:${normalizeContextTenantId(ctx.tenant) ?? 'none'}`

          const cachedElevated = ctx[cacheKey]
          if (cachedElevated !== undefined) {
            return cachedElevated as unknown as boolean | Where
          }

          const elevatedConstraint = await (async () => {
            if (!shouldApplyAdminBranchFilter(args.req)) {
              const publicBookingWhere = whereForPublicBookingTenant(ctx)
              if (publicBookingWhere) return publicBookingWhere
              const prevUser = args.req.user
              args.req.user = elevatedUser as typeof args.req.user
              try {
                return await resolveTenantAdminReadConstraint({ req: args.req as any })
              } finally {
                args.req.user = prevUser
              }
            }

            const scopeTenantIds =
              selectedTenantId != null && adminStaffTenants.includes(selectedTenantId)
                ? [selectedTenantId]
                : adminStaffTenants
            if (scopeTenantIds.length) {
              const branchScope = await resolveBranchAssignmentScope({
                payload: args.req.payload,
                user: elevatedUser,
                tenantIds: scopeTenantIds,
              })
              if (branchScope.kind === 'ids') {
                const prevUser = args.req.user
                args.req.user = elevatedUser as typeof args.req.user
                try {
                  return await whereForBranchAssignedTimeslots(args.req)
                } finally {
                  args.req.user = prevUser
                }
              }
            }

            if (selectedTenantId != null || selectedBranchId != null) {
              return whereForSelectedTenantAndOptionalBranch({
                payload: args.req.payload,
                user: elevatedUser,
                context: args.req.context as Record<string, unknown> | undefined,
                selectedTenantId,
                selectedBranchId,
              })
            }
            const publicBookingWhere = whereForPublicBookingTenant(ctx)
            if (publicBookingWhere) return publicBookingWhere
            const prevUser = args.req.user
            args.req.user = elevatedUser as typeof args.req.user
            try {
              return await resolveTenantAdminReadConstraint({ req: args.req as any })
            } finally {
              args.req.user = prevUser
            }
          })()

          ctx[cacheKey] = elevatedConstraint
          return elevatedConstraint as unknown as boolean | Where
        }
      }
    }
  }

  const base = await tenantScopedPublicReadStrict(args)
  if (base === false) return false

  if (user) return base

  const publicVisibilityConstraint: Where = {
    active: {
      equals: true,
    },
  }

  if (base === true) {
    return publicVisibilityConstraint
  }

  return {
    and: [
      base,
      publicVisibilityConstraint,
    ],
  }
}

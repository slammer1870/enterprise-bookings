import type { Access, PayloadRequest, Where } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'
import { checkRole } from '@repo/shared-utils'
import {
  tenantScopedPublicReadStrict,
  resolveTenantAdminReadConstraint,
  resolveTenantAdminTenantIds,
} from './tenant-scoped'
import {
  getPayloadLocationIdFromRequest,
  getPayloadTenantIdFromRequest,
} from '@/utilities/tenantRequest'
import {
  isPureLocationManager,
  resolvePureLocationManagerBranchIds,
} from '@/access/locationManagerScope'

/** Prefix for per-(tenant,branch) cache entries on `req.context`. */
const PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN_PREFIX = 'PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN'
const PAYLOAD_CTX_CACHED_TIMESLOTS_READ_LM_PREFIX = 'PAYLOAD_CTX_CACHED_TIMESLOTS_READ_LM'

function tenantAdminCookieSource(req: PayloadRequest): { cookies?: { get: (name: string) => { value?: string } | undefined } } {
  return { cookies: (req as PayloadRequest & { cookies?: { get: (name: string) => { value?: string } | undefined } }).cookies }
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
 * When Payload admin sets `payload-location`, constrain timeslots to that branch only if
 * the location row belongs to the selected `payload-tenant` (blocks cookie tampering).
 */
async function whereForSelectedTenantAndOptionalBranch(args: {
  payload: PayloadRequest['payload']
  user: SharedUser
  context: Record<string, unknown> | undefined
  selectedTenantId: number
  selectedBranchId: number | null
}): Promise<Where | false> {
  const { payload, user, context, selectedTenantId, selectedBranchId } = args

  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload,
    context,
  })

  if (!tenantIds.includes(selectedTenantId)) return false

  if (selectedBranchId == null) {
    return { tenant: { equals: selectedTenantId } } as Where
  }

  const location = await payload.findByID({
    collection: 'locations',
    id: selectedBranchId,
    depth: 0,
    overrideAccess: true,
  })

  if (!location) return false

  const locTenantId = relationIdFromLocationTenant(location.tenant)
  if (locTenantId !== selectedTenantId) {
    return false
  }

  // Implicit AND on `tenant` + `branch` (same as a single `{ and: [...] }` for Payload).
  return {
    tenant: { equals: selectedTenantId },
    branch: { equals: selectedBranchId },
  } as Where
}

/**
 * Pure `location-manager`: always limited to assigned branches; `payload-tenant` / `payload-location`
 * must stay within membership + assignment (cookie cannot widen scope).
 */
async function whereForPureLocationManagerTimeslots(req: PayloadRequest): Promise<Where | false> {
  const user = req.user as unknown as SharedUser
  const tenantIds = await resolveTenantAdminTenantIds({
    user,
    payload: req.payload,
    context: req.context as Record<string, unknown> | undefined,
  })
  if (!tenantIds.length) return false

  const branchIdsAll = await resolvePureLocationManagerBranchIds({
    payload: req.payload,
    user,
    tenantIds,
  })
  if (!branchIdsAll.length) return false

  const cookieSrc = tenantAdminCookieSource(req)
  const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
  const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)

  if (selectedTenantId != null) {
    if (!tenantIds.includes(selectedTenantId)) return false

    const branchesInTenant = await resolvePureLocationManagerBranchIds({
      payload: req.payload,
      user,
      tenantIds: [selectedTenantId],
    })
    if (!branchesInTenant.length) return false

    if (selectedBranchId != null) {
      if (!branchesInTenant.includes(selectedBranchId)) return false
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
  if (base === false) return false
  return {
    and: [base as Where, { branch: { in: branchIdsAll } }],
  } as Where
}

/**
 * Timeslots read access:
 * - Super-admin: full access
 * - Tenant-admin/staff: tenant scoping; when admin cookies set `payload-tenant` and
 *   optionally `payload-location`, list queries are scoped to that branch (location must
 *   belong to the selected tenant).
 * - Pure location-manager: tenant + assigned branches only (same cookie semantics; branch list from `users.locations`).
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
    return true
  }

  if (user && checkRole(['admin', 'staff'], user as any)) {
    const ctx = (args.req.context ??= {}) as Record<string, unknown>
    const cookieSrc = tenantAdminCookieSource(args.req)
    const selectedTenantId = getPayloadTenantIdFromRequest(cookieSrc)
    const selectedBranchId = getPayloadLocationIdFromRequest(cookieSrc)
    const cacheKey = `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_ADMIN_PREFIX}:${selectedTenantId ?? 'none'}:${selectedBranchId ?? 'all'}`

    const cached = ctx[cacheKey]
    if (cached !== undefined) {
      return cached as unknown as boolean | Where
    }

    const constraint = await (async () => {
      if (selectedTenantId != null) {
        return whereForSelectedTenantAndOptionalBranch({
          payload: args.req.payload,
          user,
          context: args.req.context as Record<string, unknown> | undefined,
          selectedTenantId,
          selectedBranchId,
        })
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
    const cacheKey = `${PAYLOAD_CTX_CACHED_TIMESLOTS_READ_LM_PREFIX}:${uid}:${selectedTenantId ?? 'none'}:${selectedBranchId ?? 'all'}`

    const cachedLm = ctx[cacheKey]
    if (cachedLm !== undefined) {
      return cachedLm as unknown as boolean | Where
    }

    const lmConstraint = await whereForPureLocationManagerTimeslots(args.req)
    ctx[cacheKey] = lmConstraint
    return lmConstraint as unknown as boolean | Where
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

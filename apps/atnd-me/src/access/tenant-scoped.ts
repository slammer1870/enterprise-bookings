import type { Access, Payload, Where } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { normalizeCustomDomain } from '@/utilities/validateCustomDomain'
import { getPlatformHostname } from '@/utilities/getURL'
import {
  collectTenantLookupHostnames,
  getPayloadTenantIdFromRequest,
  isBaseHostRequest,
  getTenantSlugFromHost,
  getTenantSlugFromRequest,
} from '@/utilities/tenantRequest'

/**
 * Tenant IDs from `tenants` + `registrationTenant` only (no role-based shortcuts).
 * Used when resolving membership for tenant portal access while `isAdmin(session)` is false,
 * even if the DB row incorrectly includes `super-admin` (where {@link getUserTenantIds} would return null).
 */
export function getTenantMembershipIdsFromUserDoc(user: unknown): number[] {
  if (!user || typeof user !== 'object') return []
  const tenants = (user as Record<string, unknown>).tenants as
    | Array<{ tenant?: number | { id: number }; tenant_id?: number; id?: number } | number>
    | undefined
  if (tenants && tenants.length > 0) {
    return tenants
      .map((tenant: { tenant?: number | { id: number }; tenant_id?: number; id?: number } | number) => {
        if (typeof tenant === 'object' && tenant !== null) {
          if ('tenant' in tenant) {
            const tenantValue = tenant.tenant
            return typeof tenantValue === 'object' && tenantValue !== null ? tenantValue.id : tenantValue
          }
          if ('tenant_id' in tenant && typeof tenant.tenant_id === 'number') {
            return tenant.tenant_id
          }
          if ('id' in tenant) {
            return tenant.id
          }
        }
        return tenant
      })
      .filter((id): id is number => typeof id === 'number')
  }
  const reg = (user as { registrationTenant?: number | { id: number } }).registrationTenant
  const tid = typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
  return typeof tid === 'number' ? [tid] : []
}

/**
 * Get tenant IDs that a user has access to
 * - Admin users: null (can access all tenants)
 * - Tenant-admin users: array of tenant IDs from their tenants field
 * - Regular users: empty array (no tenant management access)
 */
export function getUserTenantIds(user: SharedUser | null): number[] | null {
  if (!user) return []

  // Platform super-admin can access all tenants
  if (checkRole(['super-admin'], user as unknown as SharedUser)) {
    return null // null means "all tenants"
  }

  // Tenant org admin or staff: assigned tenants
  if (checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    return getTenantMembershipIdsFromUserDoc(user)
  }

  // Regular users have no tenant management access
  return []
}

/** Resolves tenant IDs for a tenant-admin (session user may omit `tenants`; loads from DB). */
type TenantsFindResult = {
  docs?: Array<{
    id?: unknown
  }>
}

/**
 * Single round-trip to hydrate `tenants` / `registrationTenant` when the session user omits them.
 * depth1 is enough for the multi-tenant join; depth 2 was redundant work on hot paths.
 */
export async function loadUserDocForTenantMembership(
  payload: Payload,
  userId: number,
): Promise<unknown | null> {
  return payload
    .findByID({
      collection: 'users',
      id: userId,
      depth: 1,
      overrideAccess: true,
      select: {
        id: true,
        role: true,
        tenants: true,
        registrationTenant: true,
      },
    })
    .catch(() => null)
}

export type RequestLike = {
  user?: unknown
  context?: Record<string, unknown>
  payload: Payload
  cookies?: {
    get?: (name: string) => { value?: string } | undefined
  }
  headers?: {
    get?: (name: string) => string | null
  }
}

export async function resolveTenantAdminTenantIds(args: {
  user: unknown
  payload: Payload
}): Promise<number[]> {
  const { user, payload } = args
  const direct = getUserTenantIds(user as SharedUser)
  if (direct === null) return []
  if (direct.length > 0) return direct

  // Session/JWT user often lacks relationships like `tenants` — fetch full user and retry.
  const idRaw = typeof user === 'object' && user !== null && 'id' in user ? (user as { id: unknown }).id : null
  const id = typeof idRaw === 'number' ? idRaw : typeof idRaw === 'string' ? parseInt(idRaw, 10) : NaN
  if (!Number.isFinite(id)) return []

  const fullUser = await loadUserDocForTenantMembership(payload, id)

  let fromDb = fullUser ? getUserTenantIds(fullUser as SharedUser) : []
  if (fromDb === null && fullUser && !checkRole(['super-admin'], user as SharedUser)) {
    fromDb = getTenantMembershipIdsFromUserDoc(fullUser)
  }
  return fromDb === null ? [] : fromDb
}

function getCookieFromRequestHeader(req: RequestLike, name: string): string | null {
  const cookieHeader = req.headers?.get?.('cookie') ?? ''
  if (!cookieHeader) return null
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
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

export async function resolveTenantIdFromRequest(req: RequestLike): Promise<number | null> {
  const contextTenantId = normalizeContextTenantId(req.context?.tenant)
  if (contextTenantId) return contextTenantId

  const ctx = (req.context ??= {}) as Record<string, unknown>
  const isBaseHost = isBaseHostRequest(req.headers as Headers | undefined)

  const payloadTenant = getPayloadTenantIdFromRequest({ cookies: req.cookies })
  if (isBaseHost) {
    if (payloadTenant) {
      ctx.__resolvedTenantIdFromPayloadCookie = payloadTenant
      return payloadTenant
    }
    return null
  }

  const tenantSlug =
    getTenantSlugFromRequest({
      cookies: req.cookies,
      headers: req.headers as Headers | undefined,
    }) ?? getCookieFromRequestHeader(req, 'tenant-slug') ?? null
  if (tenantSlug && /^[a-z0-9-]+$/i.test(tenantSlug)) {
    const cached = ctx.__resolvedTenantIdFromSlug
    if (typeof cached === 'number' && Number.isFinite(cached)) return cached

    const result = (await req.payload
      .find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      })
      .catch(() => null)) as TenantsFindResult | null

    const id = result?.docs?.[0]?.id
    if (typeof id === 'number') {
      ctx.__resolvedTenantIdFromSlug = id
      return id
    }
  }

  if (payloadTenant) {
    ctx.__resolvedTenantIdFromPayloadCookie = payloadTenant
    return payloadTenant
  }

  const cachedHostTenant = ctx.__resolvedTenantIdFromHost
  if (typeof cachedHostTenant === 'number' && Number.isFinite(cachedHostTenant)) {
    return cachedHostTenant
  }

  const slugFromSubdomain = getTenantSlugFromHost(req.headers as Headers | undefined)

  if (slugFromSubdomain && /^[a-z0-9-]+$/i.test(slugFromSubdomain)) {
    const result = (await req.payload
      .find({
        collection: 'tenants',
        where: { slug: { equals: slugFromSubdomain } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      })
      .catch(() => null)) as TenantsFindResult | null

    const id = result?.docs?.[0]?.id
    if (typeof id === 'number') {
      ctx.__resolvedTenantIdFromHost = id
      return id
    }
  }

  const platformHostname = getPlatformHostname()?.toLowerCase() ?? null

  for (const hostRaw of collectTenantLookupHostnames(req.headers as Headers | undefined)) {
    const hostname = (hostRaw.split(':')[0] ?? '').trim().toLowerCase()
    if (!hostname) continue
    if (hostname.includes('localhost')) continue
    if (platformHostname && (hostname === platformHostname || hostname.endsWith(`.${platformHostname}`))) {
      continue
    }

    const normalized = normalizeCustomDomain(hostname)
    if (!normalized) continue

    const result = (await req.payload
      .find({
        collection: 'tenants',
        where: { domain: { equals: normalized } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        select: { id: true } as any,
      })
      .catch(() => null)) as TenantsFindResult | null

    const id = result?.docs?.[0]?.id
    if (typeof id === 'number') {
      ctx.__resolvedTenantIdFromHost = id
      return id
    }
  }

  return null
}

/**
 * Access control for reading tenant-scoped documents
 * - Admin: can read all documents
 * - Tenant-admin: can only read documents from their assigned tenants
 * - Regular users: can read documents for booking purposes (public read)
 */
export const tenantScopedRead: Access = ({ req: { user: _user } }) => {
  // Public read access (for booking pages, etc.)
  // This allows regular users to read timeslots, event-types, etc. for booking
  return true
}

/**
 * Access control for creating tenant-scoped documents
 * - Admin: can create documents for any tenant
 * - Tenant-admin: can only create documents for their assigned tenants
 * - Regular users: cannot create configuration documents
 * 
 * Note: For isGlobal: true collections, the tenant may not be set in data when
 * accessing the create page. The beforeValidate hook will set it from req.context.tenant.
 * So we allow tenant-admin to create if they have any tenants assigned.
 */
export const tenantScopedCreate: Access = async ({ req: { user, context, payload }, data }) => {
  if (!user) return false
  
  // Admin can create for any tenant
  if (checkRole(['super-admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can only create for their assigned tenants
  if (checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    const tenantIds = await resolveTenantAdminTenantIds({ user, payload })
    if (tenantIds.length === 0) return false
    
    // If data.tenant is set, it must be one of the user's tenants (otherwise deny)
    const dataTenant = data?.tenant
    if (dataTenant !== undefined && dataTenant !== null && dataTenant !== '') {
      const raw =
        typeof dataTenant === 'object' && dataTenant !== null && 'id' in dataTenant
          ? (dataTenant as { id: unknown }).id
          : dataTenant
      const dataTenantId =
        typeof raw === 'number' && Number.isFinite(raw)
          ? raw
          : typeof raw === 'string' && /^\d+$/.test(raw)
            ? parseInt(raw, 10)
            : NaN

      if (Number.isFinite(dataTenantId) && tenantIds.includes(dataTenantId)) {
        return true
      }
      return false
    }
    
    // If data.tenant is not set, check if context.tenant is set and valid
    // This handles the case when accessing the create page (before form submission)
    const contextTenant = context?.tenant
    if (contextTenant) {
      const contextTenantId = typeof contextTenant === 'object' && contextTenant !== null && 'id' in contextTenant
        ? contextTenant.id
        : contextTenant
      
      if (contextTenantId && typeof contextTenantId === 'number' && tenantIds.includes(contextTenantId)) {
        return true
      }
    }
    
    // If no tenant is set in data or context, allow create if user has tenants
    // The beforeValidate hook will set the tenant from context when the form is submitted
    // For isGlobal: true collections, the multi-tenant plugin should set context.tenant
    return true
  }
  
  // Regular users cannot create configuration documents
  return false
}

/**
 * Access control for updating tenant-scoped documents
 * - Admin: can update documents for any tenant
 * - Tenant-admin: can only update documents from their assigned tenants
 * - Regular users: cannot update configuration documents
 */
export const tenantScopedUpdate: Access = async ({ req: { user, payload }, id: _id }) => {
  if (!user) return false
  
  // Admin can update any document
  if (checkRole(['super-admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can only update documents from their assigned tenants
  if (checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    // We need to check the document's tenant
    // This will be handled by query constraints in the access control
    const tenantIds = await resolveTenantAdminTenantIds({ user, payload })
    if (tenantIds.length === 0) return false

    // Return query constraint to filter by tenant
    return { tenant: { in: tenantIds } }
  }
  
  // Regular users cannot update configuration documents
  return false
}

/**
 * Access control for deleting tenant-scoped documents
 * - Admin: can delete documents for any tenant
 * - Tenant-admin: can only delete documents from their assigned tenants
 * - Regular users: cannot delete configuration documents
 */
export const tenantScopedDelete: Access = async ({ req: { user, payload } }) => {
  if (!user) return false
  
  // Admin can delete any document
  if (checkRole(['super-admin'], user as unknown as SharedUser)) {
    return true
  }
  
  // Tenant-admin can delete documents from their assigned tenants
  // (query constraint will be applied automatically by update access)
  if (checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    const tenantIds = await resolveTenantAdminTenantIds({ user, payload })
    if (tenantIds.length === 0) return false
    return { tenant: { in: tenantIds } }
  }
  
  // Regular users cannot delete configuration documents
  return false
}

export async function resolveTenantAdminReadConstraint(args: {
  req: {
    user?: unknown
    payload: Payload
    context?: Record<string, unknown>
    cookies?: {
      get?: (name: string) => { value?: string } | undefined
    }
    headers?: {
      get?: (name: string) => string | null
    }
  }
}): Promise<Where | false> {
  const { req } = args
  const tenantIds = await resolveTenantAdminTenantIds({ user: req.user, payload: req.payload })
  if (tenantIds.length === 0) return false

  const resolvedTenantId = await resolveTenantIdFromRequest(req as RequestLike)
  if (resolvedTenantId != null) {
    if (!tenantIds.includes(resolvedTenantId)) return false
    return {
      tenant: {
        equals: resolvedTenantId,
      },
    }
  }

  return {
    tenant: {
      in: tenantIds,
    },
  }
}

/**
 * Access control for reading tenant-scoped documents with tenant filtering
 * Used for collections where tenant-admin should only see their tenant's data
 * - Admin: can read all documents
 * - Tenant-admin: can only read documents from their assigned tenants
 * - Regular users: can read documents for the current tenant context (from subdomain)
 * 
 * IMPORTANT: When req.context.tenant is set (from subdomain), it takes precedence over
 * the user's tenants array. This allows cross-tenant booking - users can see timeslots
 * for the tenant they're viewing, regardless of their tenant assignments.
 */
export const tenantScopedReadFiltered: Access = async ({ req }) => {
  const user = req.user
  const contextTenant = req.context?.tenant
  
  // Public read - allow access (multi-tenant plugin will filter by request context)
  if (!user) return true
  
  // Admin can read all documents, but when the admin sidebar selected a tenant
  // we should scope list data to that tenant on the server as well.
  if (checkRole(['super-admin'], user as unknown as SharedUser)) {
    const resolvedTenantId = await resolveTenantIdFromRequest(req as RequestLike)
    if (resolvedTenantId != null) {
      return {
        tenant: {
          equals: resolvedTenantId,
        },
      }
    }
    return true
  }
  
  // Tenant-admin can only read documents from their assigned tenants
  if (checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    return await resolveTenantAdminReadConstraint({ req })
  }
  
  // Regular users: Allow read access for booking purposes
  // If context.tenant is set (from subdomain), return true to allow access.
  // The explicit tenant filter in the where clause will handle tenant filtering.
  // 
  // NOTE: We return true here instead of a tenant constraint because:
  // 1. The tRPC router already has an explicit tenant filter in the where clause
  // 2. Having both explicit filter AND access control constraint can cause conflicts
  // 3. The explicit filter is more reliable and easier to debug
  //
  // This allows cross-tenant booking - users can see timeslots for the tenant
  // they're viewing (from subdomain), regardless of their tenant assignments.
  if (contextTenant) {
    // Return true to allow access - tenant filtering is handled by explicit where clause
    return true
  }
  
  // No tenant context - allow read (multi-tenant plugin will handle filtering if needed)
  return true
}

/**
 * Strict tenant-scoped read for public-facing booking collections.
 * - Admin: all tenants, including when admin clears the tenant selector in Payload.
 * - Tenant-admin: only assigned tenants.
 * - Public/regular users: only the resolved tenant from request context/cookies/host.
 * - No tenant context for public/regular users: deny access to avoid cross-tenant leaks.
 */
export const tenantScopedPublicReadStrict: Access = async ({ req }) => {
  const user = req.user

  if (user && checkRole(['super-admin'], user as SharedUser)) {
    return true
  }

  if (user && checkRole(['admin', 'staff'], user as SharedUser)) {
    return await resolveTenantAdminReadConstraint({ req })
  }

  const tenantId = await resolveTenantIdFromRequest(req as RequestLike)
  if (!tenantId) return false

  return {
    tenant: {
      equals: tenantId,
    },
  }
}

/**
 * Media should never leak across tenants.
 * - Admin: all media
 * - Tenant-admin: media for their assigned tenants
 * - Public/regular users: media for the current tenant context only
 */
export const tenantScopedMediaRead: Access = ({ req }) => {
  const user = req.user
  const contextTenant = req.context?.tenant

  const whereTenantOrPublic = (tenantId: number): Where =>
    ({
      or: [{ tenant: { equals: tenantId } }, { isPublic: { equals: true } }],
    }) as unknown as Where

  const whereTenantsOrPublic = (tenantIds: number[]): Where =>
    ({
      or: [{ tenant: { in: tenantIds } }, { isPublic: { equals: true } }],
    }) as unknown as Where

  // Admin can read all documents
  if (user && checkRole(['super-admin'], user as unknown as SharedUser)) {
    return true
  }

  // Tenant-admin: constrain to their tenants
  if (user && checkRole(['admin', 'staff'], user as unknown as SharedUser)) {
    const tenantIds = getUserTenantIds(user as unknown as SharedUser)
    if (tenantIds === null || tenantIds.length === 0) return false
    return whereTenantsOrPublic(tenantIds)
  }

  // Public / regular users: only allow within current tenant context
  if (contextTenant) {
    const contextTenantId =
      typeof contextTenant === 'object' && contextTenant !== null && 'id' in contextTenant
        ? (contextTenant as { id: number }).id
        : contextTenant
    if (typeof contextTenantId === 'number') {
      return whereTenantOrPublic(contextTenantId)
    }
  }

  // Fallback: API/file requests may not have req.context.tenant set.
  // Try to resolve tenant from cookies:
  // - payload-tenant (plugin/admin cookie containing tenant id)
  // - tenant-slug (middleware cookie) -> resolve to id
  return (async () => {
    const id = await resolveTenantIdFromRequest(req as RequestLike)
    if (id) return whereTenantOrPublic(id)

    // No tenant context could be resolved: only publicly-linked media.
    return { isPublic: { equals: true } } as unknown as Where
  })()
}

/**
 * Resolve the current site tenant for React Server Components (e.g. page blocks) using
 * cookies, host, and slug — same rules as `resolveTenantIdFromRequest` on a Payload request.
 */
export async function resolveTenantIdFromServerContext(): Promise<number | null> {
  const { getPayload } = await import('@/lib/payload')
  const payload = await getPayload()
  const { cookies, headers } = await import('next/headers')
  const cookieStore = await cookies()
  const headerList = await headers()
  return resolveTenantIdFromRequest({
    payload,
    cookies: cookieStore,
    headers: headerList,
    context: {},
  })
}

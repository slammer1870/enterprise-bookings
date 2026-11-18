import type { Payload, PayloadRequest } from 'payload'

import { systemUserWriteContext } from '@/lib/auth/systemUserWriteContext'
import { normalizeTenantRoles } from '@/collections/Users/sanitizeUserWrite'
import { extractTenantId } from '@/collections/Users/tenantHookHelpers'

export type TenantMembership = {
  id?: string | null
  tenant?: unknown
  roles?: unknown
  locations?: unknown
}

/**
 * Users afterRead drops memberships the caller does not administer.
 * Set on the stored-membership read so that filter returns the full list.
 */
export const ATND_READ_ALL_MEMBERSHIPS = 'atndReadAllMemberships'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function rolesToPersist(roles: unknown): string[] {
  if (Array.isArray(roles) && roles.length > 0 && roles.every((role) => typeof role === 'string')) {
    return [...roles]
  }
  return normalizeTenantRoles(roles)
}

function rewriteMemberships(
  memberships: TenantMembership[],
  tenantId: number,
  hasTenant: boolean,
  rolesForNew: string[],
): Array<{ id?: string; tenant: unknown; roles: string[]; locations?: unknown }> {
  const rewritten = memberships.map((m) => ({
    ...(typeof m.id === 'string' && m.id ? { id: m.id } : {}),
    tenant: extractTenantId(m.tenant) ?? m.tenant,
    roles: rolesToPersist(m.roles),
    ...(m.locations !== undefined ? { locations: m.locations } : {}),
  }))
  if (!hasTenant) {
    rewritten.push({ tenant: tenantId, roles: normalizeTenantRoles(rolesForNew) })
  }
  return rewritten
}

export type ExistingUserForAttach = {
  id: number | string
  name?: string | null
  tenants?: TenantMembership[] | null
  registrationTenant?: unknown
}

export type AttachUserToTenantResult = {
  userId: number
  attached: boolean
  alreadyMember: boolean
}

/**
 * Memberships from a caller-supplied doc may have been through Users afterRead.
 * A tenant admin's read drops every organization they do not administer, and
 * writing that list back removes those memberships.
 */
async function loadStoredMemberships(
  payload: Payload,
  userId: number | string,
  req?: PayloadRequest,
): Promise<TenantMembership[]> {
  try {
    const full = (await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
      ...(req
        ? { req, context: { [ATND_READ_ALL_MEMBERSHIPS]: true } }
        : {}),
    })) as { tenants?: TenantMembership[] | null }
    return Array.isArray(full?.tenants) ? [...full.tenants] : []
  } finally {
    const context = req?.context as Record<string, unknown> | undefined
    if (context) delete context[ATND_READ_ALL_MEMBERSHIPS]
  }
}

/**
 * The create request's transaction is about to abort. Give the membership update
 * the same user and payload, but not that transaction id, so the update commits
 * on its own before the ValidationError rolls the create back.
 */
function requestOutsideCallerTransaction(req: PayloadRequest): PayloadRequest {
  return { ...req, transactionID: undefined }
}

/**
 * Add a tenants[] membership for `tenantId`. Leaves name, registrationTenant,
 * and every other membership's roles as they are.
 * Uses system write context so location-managers / field access cannot block the attach.
 * Pass `req` into the membership read so it stays on the create request.
 */
export async function attachUserToTenant(opts: {
  payload: Payload
  doc: ExistingUserForAttach
  tenantId: number
  roles?: string[]
  req?: PayloadRequest
}): Promise<AttachUserToTenantResult> {
  const { payload, doc, tenantId, req } = opts
  const rolesForNew = normalizeTenantRoles(opts.roles ?? ['user'])
  const writeContext = systemUserWriteContext({
    allowedRoles: ['user', 'admin', 'staff', 'location-manager'],
  })

  const memberships = await loadStoredMemberships(payload, doc.id, req)
  const hasTenant = memberships.some((m) => extractTenantId(m.tenant) === tenantId)

  const data: Record<string, unknown> = {}
  if (!hasTenant) {
    data.tenants = rewriteMemberships(memberships, tenantId, hasTenant, rolesForNew)
  }

  const userId = Number(doc.id)
  if (Object.keys(data).length > 0) {
    await payload.update({
      collection: 'users',
      id: doc.id,
      data,
      overrideAccess: true,
      depth: 0,
      context: writeContext,
      ...(req ? { req: requestOutsideCallerTransaction(req) } : {}),
    })
  }

  return {
    userId,
    attached: !hasTenant,
    alreadyMember: hasTenant,
  }
}

/**
 * Roles requested for `tenantId` on an admin create form, else `['user']`.
 * Callers must only pass this through when the actor is allowed to grant those roles.
 */
export function rolesForTenantFromCreateData(
  data: Record<string, unknown> | null | undefined,
  tenantId: number,
): string[] {
  if (!data || !Array.isArray(data.tenants)) return ['user']
  for (const entry of data.tenants) {
    if (!entry || typeof entry !== 'object') continue
    const tid = extractTenantId((entry as TenantMembership).tenant)
    if (tid === tenantId) {
      return normalizeTenantRoles((entry as TenantMembership).roles)
    }
  }
  return ['user']
}

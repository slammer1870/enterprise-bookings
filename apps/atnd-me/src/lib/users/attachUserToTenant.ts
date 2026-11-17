import type { Payload } from 'payload'

import { systemUserWriteContext } from '@/lib/auth/systemUserWriteContext'
import { normalizeTenantRoles } from '@/collections/Users/sanitizeUserWrite'
import { extractTenantId } from '@/collections/Users/tenantHookHelpers'

export type TenantMembership = {
  id?: string | null
  tenant?: unknown
  roles?: unknown
  locations?: unknown
}

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
 * Add a tenants[] membership for `tenantId`. Leaves name, registrationTenant,
 * and every other membership's roles as they are.
 * Uses system write context so location-managers / field access cannot block the attach.
 * Do not pass `req`. The caller throws ValidationError after a successful attach,
 * and that error rolls back every write that joined the create transaction.
 */
export async function attachUserToTenant(opts: {
  payload: Payload
  doc: ExistingUserForAttach
  tenantId: number
  roles?: string[]
}): Promise<AttachUserToTenantResult> {
  const { payload, doc, tenantId } = opts
  const rolesForNew = normalizeTenantRoles(opts.roles ?? ['user'])
  const writeContext = systemUserWriteContext({
    allowedRoles: ['user', 'admin', 'staff', 'location-manager'],
  })

  const memberships = Array.isArray(doc.tenants) ? [...doc.tenants] : []
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

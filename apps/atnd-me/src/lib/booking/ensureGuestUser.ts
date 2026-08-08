import crypto from 'crypto'
import type { Payload } from 'payload'

import { systemUserWriteContext } from '@/lib/auth/systemUserWriteContext'
import { normalizeTenantRoles } from '@/collections/Users/sanitizeUserWrite'

export type EnsureGuestUserResult = {
  userId: number
  created: boolean
  email: string
  name: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function extractTenantId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw)
  if (raw && typeof raw === 'object' && 'id' in raw) {
    const id = (raw as { id: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id)
  }
  return null
}

function membershipNeedsRoleRepair(roles: unknown): boolean {
  if (!Array.isArray(roles) || roles.length === 0) return true
  const plain = roles.every((r) => typeof r === 'string' && normalizeTenantRoles([r])[0] === r)
  if (!plain) return true
  return new Set(roles as string[]).size !== roles.length
}

type TenantMembership = {
  id?: string | null
  tenant?: unknown
  roles?: unknown
}

function rewriteMemberships(
  memberships: TenantMembership[],
  tenantId: number,
  hasTenant: boolean,
): Array<{ id?: string; tenant: unknown; roles: string[] }> {
  const rewritten = memberships.map((m) => ({
    ...(typeof m.id === 'string' && m.id ? { id: m.id } : {}),
    tenant: extractTenantId(m.tenant) ?? m.tenant,
    roles: normalizeTenantRoles(m.roles),
  }))
  if (!hasTenant) {
    rewritten.push({ tenant: tenantId, roles: ['user'] })
  }
  return rewritten
}

function hasRegistrationTenant(raw: unknown): boolean {
  if (raw == null || raw === '') return false
  return extractTenantId(raw) != null || typeof raw === 'string'
}

type ExistingGuestUser = {
  id: number
  name?: string | null
  tenants?: TenantMembership[] | null
  registrationTenant?: unknown
}

async function syncExistingGuestUser(opts: {
  payload: Payload
  doc: ExistingGuestUser
  name: string
  tenantId: number
  writeContext: ReturnType<typeof systemUserWriteContext>
}): Promise<Omit<EnsureGuestUserResult, 'email'>> {
  const { payload, doc, name, tenantId, writeContext } = opts
  const memberships = Array.isArray(doc.tenants) ? [...doc.tenants] : []
  const hasTenant = memberships.some((m) => extractTenantId(m.tenant) === tenantId)
  const needsRoleRepair = memberships.some((m) => membershipNeedsRoleRepair(m.roles))

  const data: Record<string, unknown> = {}
  if (!doc.name?.trim() && name) {
    data.name = name
  }
  if (!hasTenant || needsRoleRepair) {
    data.tenants = rewriteMemberships(memberships, tenantId, hasTenant)
  }
  // Guest course/event signup must always have a registration tenant. Backfill if
  // the account was created elsewhere without one (or an earlier write omitted it).
  if (!hasRegistrationTenant(doc.registrationTenant)) {
    data.registrationTenant = tenantId
  }

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
    userId: Number(doc.id),
    created: false,
    name: doc.name?.trim() || name,
  }
}

/**
 * Find or create a user for guest event/course checkout.
 * Always assigns `registrationTenant` on create, and backfills it when missing
 * on an existing account. Does not create a browser session — bookings attach
 * to this userId only.
 */
export async function ensureGuestUser(opts: {
  payload: Payload
  name: string
  email: string
  tenantId: number
}): Promise<EnsureGuestUserResult> {
  const { payload, tenantId } = opts
  const email = normalizeEmail(opts.email)
  const name = opts.name.trim()
  const writeContext = systemUserWriteContext({
    // Create: only `user`. Update may preserve existing elevated memberships on other tenants.
    allowedRoles: ['user', 'admin', 'staff', 'location-manager'],
  })

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required')
  }
  if (!name) {
    throw new Error('Name is required')
  }

  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    context: writeContext,
  })

  const doc = existing.docs[0] as ExistingGuestUser | undefined

  if (doc) {
    const result = await syncExistingGuestUser({
      payload,
      doc,
      name,
      tenantId,
      writeContext,
    })
    return { ...result, email }
  }

  const randomPassword = crypto.randomBytes(32).toString('hex')
  try {
    const created = await payload.create({
      collection: 'users',
      data: {
        name,
        email,
        password: randomPassword,
        emailVerified: false,
        role: ['user'],
        registrationTenant: tenantId,
        tenants: [{ tenant: tenantId, roles: ['user'] }],
      },
      overrideAccess: true,
      depth: 0,
      context: systemUserWriteContext({ allowedRoles: ['user'] }),
    })

    return { userId: Number(created.id), created: true, email, name }
  } catch (err) {
    // Concurrent guest Continuues can race: two creates for the same email → Payload
    // returns "The following field is invalid: email". Recover by loading the winner.
    const message = err instanceof Error ? err.message : String(err)
    const emailConflict =
      /field is invalid:\s*email/i.test(message) ||
      (/email/i.test(message) && /(unique|duplicate|already)/i.test(message))
    if (!emailConflict) throw err

    const raced = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      context: writeContext,
    })
    const racedDoc = raced.docs[0] as ExistingGuestUser | undefined
    if (!racedDoc?.id) throw err

    const result = await syncExistingGuestUser({
      payload,
      doc: racedDoc,
      name,
      tenantId,
      writeContext,
    })
    return { ...result, email }
  }
}

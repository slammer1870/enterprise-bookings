import crypto from 'crypto'
import type { Payload } from 'payload'

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

/**
 * Find or create a user for guest event checkout.
 * Does not create a browser session — bookings attach to this userId only.
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

  if (!email || !email.includes('@')) {
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
  })

  const doc = existing.docs[0] as
    | {
        id: number
        name?: string | null
        tenants?: Array<{ tenant?: unknown; roles?: string[] | null }> | null
      }
    | undefined

  if (doc) {
    const memberships = Array.isArray(doc.tenants) ? [...doc.tenants] : []
    const hasTenant = memberships.some((m) => extractTenantId(m.tenant) === tenantId)

    const data: Record<string, unknown> = {}
    if (!doc.name?.trim() && name) {
      data.name = name
    }
    if (!hasTenant) {
      data.tenants = [
        ...memberships.map((m) => ({
          tenant: extractTenantId(m.tenant) ?? m.tenant,
          roles: m.roles?.length ? m.roles : ['user'],
        })),
        { tenant: tenantId, roles: ['user'] },
      ]
    }

    if (Object.keys(data).length > 0) {
      await payload.update({
        collection: 'users',
        id: doc.id,
        data,
        overrideAccess: true,
        depth: 0,
      })
    }

    return { userId: Number(doc.id), created: false, email, name: doc.name?.trim() || name }
  }

  const randomPassword = crypto.randomBytes(32).toString('hex')
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
  })

  return { userId: Number(created.id), created: true, email, name }
}

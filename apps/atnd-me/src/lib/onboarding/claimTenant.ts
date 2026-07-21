import crypto from 'crypto'
import type { Payload, PayloadRequest } from 'payload'

import { getTenantSubdomainURL } from '@/utilities/getURL'
import { bootstrapNewTenant } from './bootstrapNewTenant'
import { normalizeAndValidateTenantSlug } from './slug'

export type ClaimTenantInput = {
  slug: string
  tenantName: string
  name: string
  email: string
}

export type ClaimTenantResult =
  | { ok: true; tenantId: number; userId: number; slug: string; adminURL: string }
  | { ok: false; status: number; error: string; code?: string }

type BetterAuthLike = {
  api: {
    signInMagicLink: (args: {
      body: { email: string; callbackURL?: string }
      headers: Headers
    }) => Promise<unknown>
  }
}

type TenantMembership = {
  tenant: number | { id: number }
  roles?: string[] | null
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

function normalizeMemberships(raw: unknown): TenantMembership[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const tenantId = extractTenantId((entry as TenantMembership).tenant)
      if (tenantId == null) return null
      const roles = Array.isArray((entry as TenantMembership).roles)
        ? ((entry as TenantMembership).roles as string[])
        : ['user']
      return { tenant: tenantId, roles }
    })
    .filter((e): e is { tenant: number; roles: string[] } => e != null)
}

function withAdminRole(existingRole: unknown): string[] {
  const roles = Array.isArray(existingRole)
    ? existingRole.filter((r): r is string => typeof r === 'string' && r.length > 0)
    : typeof existingRole === 'string' && existingRole
      ? [existingRole]
      : []

  if (roles.includes('super-admin')) return roles
  return [...new Set([...roles, 'admin'])]
}

/**
 * Create a new tenant + assign (or create) the user as tenant admin, then send a magic link.
 * If the email already exists, the new tenant is added to that user as admin (no account takeover —
 * the magic link is only delivered to their inbox).
 */
export async function claimTenant(opts: {
  payload: Payload & { betterAuth?: BetterAuthLike }
  input: ClaimTenantInput
  headers: Headers
  req?: PayloadRequest
  /** Test seam — when set, skips `payload.betterAuth.api.signInMagicLink`. */
  sendMagicLink?: (args: {
    email: string
    callbackURL: string
    headers: Headers
  }) => Promise<unknown>
}): Promise<ClaimTenantResult> {
  const { payload, headers, req } = opts

  const slugResult = normalizeAndValidateTenantSlug(opts.input.slug)
  if (!slugResult.ok) {
    return { ok: false, status: 400, error: slugResult.error, code: 'invalid_slug' }
  }
  const slug = slugResult.slug

  const tenantName = opts.input.tenantName?.trim()
  const name = opts.input.name?.trim()
  const email = opts.input.email?.trim().toLowerCase()

  if (!tenantName) {
    return { ok: false, status: 400, error: 'Business name is required', code: 'invalid_tenant_name' }
  }
  if (!name) {
    return { ok: false, status: 400, error: 'Your name is required', code: 'invalid_name' }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'A valid email is required', code: 'invalid_email' }
  }

  const existingSlug = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (existingSlug.docs[0]) {
    return { ok: false, status: 409, error: 'This username is already taken', code: 'slug_taken' }
  }

  const existingUserResult = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const existingUser = existingUserResult.docs[0] ?? null

  const tenant = await payload.create({
    collection: 'tenants',
    data: {
      name: tenantName,
      slug,
      timeZone: 'Europe/Dublin',
      stripeConnectOnboardingStatus: 'not_connected',
    },
    overrideAccess: true,
    req,
  })

  const tenantId = Number(tenant.id)
  if (!Number.isFinite(tenantId)) {
    return { ok: false, status: 500, error: 'Failed to create tenant', code: 'tenant_create_failed' }
  }

  await bootstrapNewTenant(payload, tenantId, tenantName, req)

  let userId: number

  if (existingUser) {
    const memberships = normalizeMemberships(
      (existingUser as { tenants?: unknown }).tenants,
    )
    const alreadyHasTenant = memberships.some((m) => m.tenant === tenantId)
    const nextTenants = alreadyHasTenant
      ? memberships.map((m) =>
          m.tenant === tenantId
            ? {
                tenant: m.tenant,
                roles: [...new Set([...(m.roles ?? []), 'admin'])],
              }
            : m,
        )
      : [...memberships, { tenant: tenantId, roles: ['admin'] }]

    const alreadyHasPassword =
      Boolean((existingUser as { onboardingPasswordSetAt?: unknown }).onboardingPasswordSetAt)

    const updated = await payload.update({
      collection: 'users',
      id: existingUser.id,
      data: {
        tenants: nextTenants,
        role: withAdminRole((existingUser as { role?: unknown }).role),
        // Existing accounts already chose a password — skip the checklist step.
        ...(alreadyHasPassword
          ? {}
          : { onboardingPasswordSetAt: new Date().toISOString() }),
      },
      overrideAccess: true,
      depth: 0,
      req,
    } as Parameters<typeof payload.update>[0])

    userId = Number(updated.id)
  } else {
    const randomPassword = crypto.randomBytes(32).toString('hex')

    const user = await payload.create({
      collection: 'users',
      data: {
        name,
        email,
        password: randomPassword,
        emailVerified: false,
        role: ['admin'],
        registrationTenant: tenantId,
        tenants: [{ tenant: tenantId, roles: ['admin'] }],
        // Left null so the onboarding checklist asks them to set a real password.
        onboardingPasswordSetAt: null,
      },
      overrideAccess: true,
      depth: 0,
      req,
    } as Parameters<typeof payload.create>[0])

    userId = Number(user.id)
  }

  if (!Number.isFinite(userId)) {
    return { ok: false, status: 500, error: 'Failed to create user', code: 'user_create_failed' }
  }

  const adminURL = `${getTenantSubdomainURL(slug, headers)}/admin`

  if (opts.sendMagicLink) {
    await opts.sendMagicLink({ email, callbackURL: adminURL, headers })
  } else {
    if (!payload.betterAuth?.api?.signInMagicLink) {
      return { ok: false, status: 500, error: 'Auth is not configured', code: 'auth_unavailable' }
    }

    await payload.betterAuth.api.signInMagicLink({
      body: {
        email,
        callbackURL: adminURL,
      },
      headers,
    })
  }

  return { ok: true, tenantId, userId, slug, adminURL }
}

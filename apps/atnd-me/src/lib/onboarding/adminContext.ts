/**
 * Shared helpers for admin onboarding checklist APIs.
 */
import type { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import type { User as SharedUser } from '@repo/shared-types'

import { getUserTenantIds } from '@/access/tenant-scoped'
import { isAdmin, isTenantAdmin } from '@/access/userTenantAccess'
import { getTenantSiteURL } from '@/utilities/getURL'
import { getTenantSlugFromHost } from '@/utilities/tenantRequest'

export async function resolveOnboardingUser(
  payload: Payload,
  request: NextRequest,
): Promise<SharedUser | null> {
  const authResult = await payload.auth({ headers: request.headers })
  let user = (authResult?.user as SharedUser) ?? null
  if (!user) return null

  const userId = user.id != null ? Number(user.id) : NaN
  if (Number.isFinite(userId)) {
    const fullUser = await payload
      .findByID({
        collection: 'users',
        id: userId,
        depth: 2,
        overrideAccess: true,
        select: {
          id: true,
          role: true,
          tenants: true,
          registrationTenant: true,
          onboardingPasswordSetAt: true,
        } as any,
      })
      .catch(() => null)
    if (fullUser) {
      user = fullUser as unknown as SharedUser
    }
  }

  if (!isAdmin(user) && !isTenantAdmin(user)) return null
  return user
}

function parsePositiveInt(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  return Number(raw)
}

function allowedTenantIds(user: SharedUser): number[] | null {
  let tenantIds = getUserTenantIds(user)
  if (isTenantAdmin(user) && (tenantIds === null || tenantIds.length === 0)) {
    const reg = (user as unknown as { registrationTenant?: number | { id: number } })
      .registrationTenant
    const tid = typeof reg === 'object' && reg !== null && 'id' in reg ? reg.id : reg
    if (typeof tid === 'number') {
      tenantIds = [tid]
    }
  }
  return tenantIds
}

function isAllowedTenant(tenantIds: number[] | null, id: number): boolean {
  if (tenantIds === null) return true
  return tenantIds.includes(id)
}

async function lookupTenantIdBySlug(
  payload: Payload,
  slug: string,
): Promise<number | null> {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: normalized } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true } as any,
  })
  const id = result.docs[0]?.id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id)
  return null
}

/**
 * Resolve which tenant the onboarding checklist applies to.
 *
 * Priority:
 * 1. Host subdomain (admin is usually on `{slug}.platform`) — beats a stale selector cookie
 * 2. Explicit `tenantId` / `tenantSlug` query (dashboard / platform-root selector)
 * 3. `payload-tenant` cookie
 * 4. First membership
 */
export async function resolveOnboardingTenantId(
  payload: Payload,
  user: SharedUser,
  request: NextRequest,
): Promise<number | null> {
  const tenantIds = allowedTenantIds(user)

  const hostSlug = getTenantSlugFromHost(request.headers)
  if (hostSlug) {
    const fromHost = await lookupTenantIdBySlug(payload, hostSlug)
    if (fromHost != null && isAllowedTenant(tenantIds, fromHost)) {
      return fromHost
    }
  }

  const queryTenantId = parsePositiveInt(request.nextUrl.searchParams.get('tenantId'))
  if (queryTenantId != null && isAllowedTenant(tenantIds, queryTenantId)) {
    return queryTenantId
  }

  const querySlug = request.nextUrl.searchParams.get('tenantSlug')?.trim()
  if (querySlug) {
    const fromQuerySlug = await lookupTenantIdBySlug(payload, querySlug)
    if (fromQuerySlug != null && isAllowedTenant(tenantIds, fromQuerySlug)) {
      return fromQuerySlug
    }
  }

  if (tenantIds === null) {
    // Super-admin on platform root with no selector: no safe default for public site URL.
    const cookieTenantId = parsePositiveInt(request.cookies.get('payload-tenant')?.value)
    return cookieTenantId
  }

  if (tenantIds.length === 0) return null

  const cookieTenantId = parsePositiveInt(request.cookies.get('payload-tenant')?.value)
  if (cookieTenantId != null && tenantIds.includes(cookieTenantId)) {
    return cookieTenantId
  }

  return tenantIds[0] as number
}

export function buildTenantPublicSiteURL(
  tenant: { slug?: string | null; domain?: string | null },
  request: NextRequest,
): string {
  return getTenantSiteURL(tenant, request.headers)
}

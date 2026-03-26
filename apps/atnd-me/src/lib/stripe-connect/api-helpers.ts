/**
 * Shared helpers for Stripe Connect API routes (auth, tenant resolution).
 */
import type { NextRequest } from 'next/server'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getUserTenantIds } from '@/access/tenant-scoped'

export type TenantForConnect = {
  id: number
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: string | null
}

/** Resolve tenant slug/id from request (headers, cookies, searchParams). Supports test mode. */
export function resolveTenantSlugOrId(request: NextRequest): string | null {
  if (process.env.NODE_ENV === 'test') {
    const id = request.headers.get('x-tenant-id')
    if (id) return id
  }
  return (
    request.headers.get('x-tenant-slug') ??
    request.headers.get('x-tenant-id') ??
    request.cookies.get('tenant-slug')?.value ??
    request.nextUrl.searchParams.get('tenantSlug') ??
    null
  )
}

/** Get current user from Payload auth or test headers. */
export async function getCurrentUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  request: NextRequest
): Promise<SharedUser | null> {
  if (process.env.NODE_ENV === 'test') {
    const testUserId = request.headers.get('x-test-user-id')
    if (testUserId) {
      const u = await payload.findByID({
        collection: 'users',
        id: parseInt(testUserId, 10),
        overrideAccess: true,
        select: { id: true, email: true, name: true, roles: true, tenants: true } as any,
      })
      return u as unknown as SharedUser
    }
  }
  const authResult = await payload.auth({ headers: request.headers })
  return (authResult?.user as SharedUser) ?? null
}

/** Resolve tenant for Stripe Connect by slug or numeric ID. Returns TenantForConnect or null. */
export async function resolveTenantForConnect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  slugOrId: string
): Promise<TenantForConnect | null> {
  if (process.env.NODE_ENV === 'test' && /^\d+$/.test(slugOrId)) {
    const t = await payload.findByID({
      collection: 'tenants',
      id: parseInt(slugOrId, 10),
      depth: 0,
      overrideAccess: true,
      select: { id: true, stripeConnectAccountId: true, stripeConnectOnboardingStatus: true } as any,
    })
    return t as TenantForConnect | null
  }
  const result = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: String(slugOrId) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    select: { id: true, stripeConnectAccountId: true, stripeConnectOnboardingStatus: true } as any,
  })
  return (result.docs[0] as TenantForConnect) ?? null
}

/** Check user has one of the roles and (optionally) access to tenantId. */
export function userHasStripeConnectAccess(
  user: SharedUser | null,
  roles: ('admin' | 'tenant-admin')[],
  tenantId?: number
): boolean {
  if (!user) return false
  if (!checkRole([...roles], user)) return false
  if (tenantId !== undefined) {
    const tenantIds = getUserTenantIds(user)
    if (tenantIds !== null && !tenantIds.includes(tenantId)) return false
  }
  return true
}

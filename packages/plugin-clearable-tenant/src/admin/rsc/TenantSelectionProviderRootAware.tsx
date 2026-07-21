import { cookies as getCookies } from 'next/headers'
import { headers as getHeaders } from 'next/headers'
import React from 'react'
import type { Payload } from 'payload'
import { TenantSelectionProviderRootAwareClient } from '../client/TenantSelectionProviderRootAwareClient'

import type { TenantOption } from '../../types'

function defaultUserHasAccessToAllTenants(user: unknown): boolean {
  if (!user) return false
  const u = user as { roles?: string[] }
  return Array.isArray(u.roles) && u.roles.includes('admin')
}

function getRootHostnameFromEnv(): string | null {
  const url = process.env.NEXT_PUBLIC_SERVER_URL
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

function isHostLockedServer(hostHeader: string | null): boolean {
  const root = getRootHostnameFromEnv()
  if (!root) return false
  const host = (hostHeader ?? '').split(':')[0] ?? ''
  if (!host) return false

  if (root === 'localhost') {
    // In local dev/tests, tenant hosts are `tenant.localhost`.
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return false
    return host.endsWith('.localhost')
  }

  // Any non-root host counts as locked (tenant subdomain or custom domain).
  if (host === root) return false
  return true
}

/**
 * Extract the tenant slug from the Host header for subdomain-based tenants.
 * Used as a last-resort fallback when neither `payload-tenant` nor `tenant-slug`
 * cookies are present in the request (e.g. on the very first navigation to a
 * tenant subdomain, when middleware sets cookies in Set-Cookie but they have not
 * yet reached the next request's cookie jar).
 */
function tenantSlugFromHost(hostHeader: string | null): string | null {
  const root = getRootHostnameFromEnv()?.toLowerCase() ?? null
  if (!root) return null
  const host = ((hostHeader ?? '').split(':')[0] ?? '').toLowerCase()
  if (!host) return null

  if (root === 'localhost') {
    // e.g. "test-tenant-1.localhost:3000" → "test-tenant-1"
    const parts = host.split('.')
    if (parts.length > 1 && parts[0] && parts[0] !== 'localhost') return parts[0]
    return null
  }

  if (host.endsWith('.' + root)) {
    const prefix = host.slice(0, -(root.length + 1))
    return prefix.split('.')[0] || null
  }

  return null
}

async function getTenantOptions({
  payload,
  tenantsArrayFieldName,
  tenantsArrayTenantFieldName,
  tenantsCollectionSlug,
  useAsTitle,
  user,
  userHasAccessToAllTenants,
}: {
  payload: Payload
  tenantsArrayFieldName: string
  tenantsArrayTenantFieldName: string
  tenantsCollectionSlug: string
  useAsTitle: string
  user: unknown
  userHasAccessToAllTenants: (u: unknown) => boolean | Promise<boolean>
}): Promise<TenantOption[]> {
  if (!user) return []
  const coll = payload.collections[tenantsCollectionSlug as keyof typeof payload.collections]
  const isOrderable = (coll?.config as { orderable?: boolean })?.orderable ?? false
  const hasAccess = await Promise.resolve(userHasAccessToAllTenants(user))
  const u = user as Record<string, unknown>
  const extractIds = (rec: Record<string, unknown>): (string | number)[] | undefined => {
    if (rec[tenantsArrayFieldName] == null) return undefined
    return (rec[tenantsArrayFieldName] as unknown[])
      .map((row) => {
        const field = (row as Record<string, unknown>)[tenantsArrayTenantFieldName]
        if (typeof field === 'string' || typeof field === 'number') return field
        if (field && typeof field === 'object' && 'id' in field) return (field as { id: number }).id
        return undefined
      })
      .filter((id): id is number | string => id !== undefined)
  }

  let userTenantIds = hasAccess ? undefined : extractIds(u)

  if (!hasAccess && (!userTenantIds || userTenantIds.length === 0)) {
    const idRaw = u.id
    const uid =
      typeof idRaw === 'number'
        ? idRaw
        : typeof idRaw === 'string' && /^\d+$/.test(idRaw)
          ? parseInt(idRaw, 10)
          : NaN
    if (Number.isFinite(uid)) {
      const fullUser = await payload
        .findByID({
          collection: 'users',
          id: uid,
          depth: 2,
          overrideAccess: true,
        })
        .catch(() => null)
      if (fullUser) {
        userTenantIds = extractIds(fullUser as unknown as Record<string, unknown>)
      }
    }
  }

  const result = await payload.find({
    collection: tenantsCollectionSlug as keyof typeof payload.collections,
    depth: 0,
    // Payload treats limit 0 as "no rows" in recent versions — need enough rows for the selector.
    limit: 500,
    overrideAccess: false,
    select: { [useAsTitle]: true, slug: true } as Parameters<Payload['find']>[0]['select'],
    sort: isOrderable ? '_order' : useAsTitle,
    user: user as Parameters<Payload['find']>[0]['user'],
    ...(userTenantIds?.length ? { where: { id: { in: userTenantIds } } } : {}),
  })

  return result.docs.map((doc) => {
    const d = doc as unknown as Record<string, unknown>
    return {
      label: String(d[useAsTitle]),
      value: (doc as { id: number | string }).id,
      slug: typeof d.slug === 'string' ? d.slug : undefined,
    }
  })
}

const DEFAULT_TENANTS_COLLECTION_SLUG = 'tenants'
const DEFAULT_TENANTS_ARRAY_FIELD_NAME = 'tenants'
const DEFAULT_TENANTS_ARRAY_TENANT_FIELD_NAME = 'tenant'
const DEFAULT_USE_AS_TITLE = 'name'

type Props = {
  children: React.ReactNode
  payload?: Payload
  tenantsArrayFieldName?: string
  tenantsArrayTenantFieldName?: string
  tenantsCollectionSlug?: string
  useAsTitle?: string
  user?: unknown
  userHasAccessToAllTenants?: (u: unknown) => boolean | Promise<boolean>
  rootDocCollections?: string[]
  collectionsRequireTenantOnCreate?: string[]
  collectionsCreateRequireTenantForTenantAdmin?: string[]
  collectionsWithTenantField?: string[]
  documentTenantFieldName?: string
  getCookieDomain?: () => string | undefined
  initialUserRoles?: string[]
}

export async function TenantSelectionProviderRootAware(props: Props) {
  const {
    children,
    payload: payloadProp,
    tenantsArrayFieldName = DEFAULT_TENANTS_ARRAY_FIELD_NAME,
    tenantsArrayTenantFieldName = DEFAULT_TENANTS_ARRAY_TENANT_FIELD_NAME,
    tenantsCollectionSlug = DEFAULT_TENANTS_COLLECTION_SLUG,
    useAsTitle = DEFAULT_USE_AS_TITLE,
    user,
    userHasAccessToAllTenants: userHasAccessToAllTenantsProp,
    rootDocCollections = ['navbar', 'footer'],
    collectionsRequireTenantOnCreate = [],
    collectionsCreateRequireTenantForTenantAdmin = ['pages', 'navbar', 'footer'],
    collectionsWithTenantField = [],
    documentTenantFieldName = 'tenant',
    getCookieDomain,
  } = props

  const userHasAccessToAllTenants =
    typeof userHasAccessToAllTenantsProp === 'function'
      ? userHasAccessToAllTenantsProp
      : defaultUserHasAccessToAllTenants

  let tenantOptions: TenantOption[] = []
  let initialValue: string | number | undefined

  const hostHeaders = await getHeaders()
  const hostHeader = hostHeaders.get('host')
  const initialIsHostLocked = isHostLockedServer(hostHeader)

  if (payloadProp && user) {
    tenantOptions = await getTenantOptions({
      payload: payloadProp,
      tenantsArrayFieldName,
      tenantsArrayTenantFieldName,
      tenantsCollectionSlug,
      useAsTitle,
      user,
      userHasAccessToAllTenants,
    })
    const cookieStore = await getCookies()
    const tenantCookie = cookieStore.get('payload-tenant')?.value
    if (tenantCookie) {
      const match = tenantOptions.find((o) => String(o.value) === tenantCookie)
      initialValue = match?.value
    } else {
      // Priority 1: tenant-slug cookie (set by middleware on earlier requests)
      const tenantSlug = initialIsHostLocked ? cookieStore.get('tenant-slug')?.value : undefined
      if (tenantSlug) {
        const matchBySlug = tenantOptions.find((o) => o.slug === tenantSlug)
        initialValue = matchBySlug?.value
      } else if (initialIsHostLocked) {
        // Priority 2: derive slug directly from the Host header.
        // This handles the very first navigation to a tenant subdomain: middleware sets
        // `tenant-slug` and `payload-tenant` in Set-Cookie but they have not reached
        // the *request* cookie jar yet, so cookies().get() returns undefined. The Host
        // header is always present and reliably identifies the current tenant.
        const slugFromHost = tenantSlugFromHost(hostHeader)
        if (slugFromHost) {
          const matchByHost = tenantOptions.find((o) => o.slug === slugFromHost)
          initialValue = matchByHost?.value
        } else {
          initialValue = undefined
          if (tenantOptions.length <= 1) initialValue = tenantOptions[0]?.value
        }
      } else {
        initialValue = undefined
        if (tenantOptions.length <= 1) initialValue = tenantOptions[0]?.value
      }
    }
    if (initialValue == null && tenantOptions.length > 1) initialValue = undefined
  } else {
    initialValue = undefined
    // When payload/user not passed (e.g. Payload admin not passing serverProps), still mount client provider so it can fetch options.
  }

  const initialUserRoles =
    user && typeof user === 'object' && Array.isArray((user as { roles?: unknown }).roles)
      ? ((user as { roles: string[] }).roles ?? [])
      : []

  return (
    <TenantSelectionProviderRootAwareClient
      initialTenantOptions={tenantOptions}
      initialValue={initialValue}
      initialUserRoles={initialUserRoles}
      initialIsHostLocked={initialIsHostLocked}
      tenantsCollectionSlug={tenantsCollectionSlug}
      rootDocCollections={rootDocCollections}
      collectionsRequireTenantOnCreate={collectionsRequireTenantOnCreate}
      collectionsCreateRequireTenantForTenantAdmin={collectionsCreateRequireTenantForTenantAdmin}
      collectionsWithTenantField={collectionsWithTenantField}
      documentTenantFieldName={documentTenantFieldName}
      getCookieDomain={getCookieDomain}
    >
      {children}
    </TenantSelectionProviderRootAwareClient>
  )
}


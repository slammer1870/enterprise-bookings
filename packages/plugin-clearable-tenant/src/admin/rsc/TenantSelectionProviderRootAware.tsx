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
      const h = await getHeaders()
      const isHostLocked = isHostLockedServer(h.get('host'))
      const tenantSlug = isHostLocked ? cookieStore.get('tenant-slug')?.value : undefined
      if (tenantSlug) {
        const matchBySlug = tenantOptions.find((o) => o.slug === tenantSlug)
        initialValue = matchBySlug?.value
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

  return (
    <TenantSelectionProviderRootAwareClient
      initialTenantOptions={tenantOptions}
      initialValue={initialValue}
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


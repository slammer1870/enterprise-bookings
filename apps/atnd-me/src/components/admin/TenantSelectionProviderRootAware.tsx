import { cookies as getCookies } from 'next/headers'
import React from 'react'
import type { Payload } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { TenantSelectionProviderRootAwareClient } from './TenantSelectionProviderRootAwareClient'

/** Fallback when plugin does not pass userHasAccessToAllTenants (e.g. after we replace the provider). */
function defaultUserHasAccessToAllTenants(user: unknown): boolean {
  if (!user) return false
  return checkRole(['admin'], user as unknown as SharedUser)
}

/**
 * Duplicates the plugin's getTenantOptions server logic so we can pass options to our client provider.
 */
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
}): Promise<{ label: string; value: number | string }[]> {
  if (!user) return []
  const coll = payload.collections[tenantsCollectionSlug as keyof typeof payload.collections]
  const isOrderable = coll?.config?.orderable ?? false
  const hasAccess = await Promise.resolve(userHasAccessToAllTenants(user))
  const userTenantIds = hasAccess
    ? undefined
    : (user as Record<string, unknown>)[tenantsArrayFieldName] != null
      ? ((user as Record<string, unknown>)[tenantsArrayFieldName] as unknown[]).map((row) => {
          const field = (row as Record<string, unknown>)[tenantsArrayTenantFieldName]
          if (typeof field === 'string' || typeof field === 'number') return field
          if (field && typeof field === 'object' && 'id' in field) return (field as { id: number }).id
          return undefined
        }).filter((id): id is number | string => id !== undefined)
      : undefined

  const result = await payload.find({
    collection: tenantsCollectionSlug as keyof typeof payload.collections,
    depth: 0,
    limit: 0,
    overrideAccess: false,
    select: { [useAsTitle]: true } as Parameters<Payload['find']>[0]['select'],
    sort: isOrderable ? '_order' : useAsTitle,
    user: user as Parameters<Payload['find']>[0]['user'],
    ...(userTenantIds?.length ? { where: { id: { in: userTenantIds } } } : {}),
  })

  return result.docs.map((doc) => ({
    label: String((doc as unknown as Record<string, unknown>)[useAsTitle]),
    value: (doc as { id: number | string }).id,
  }))
}

/** Defaults matching apps/atnd-me multiTenantPlugin({ tenantsSlug: 'tenants' }) and Tenants collection. */
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
}

/**
 * Root-aware TenantSelectionProvider. Same as the plugin's except the client does not
 * auto-set the first tenant when viewing navbar/footer (so the root doc can be edited).
 * When used in place of the plugin's provider, props may be missing; we apply defaults.
 */
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
  } = props

  const userHasAccessToAllTenants =
    typeof userHasAccessToAllTenantsProp === 'function'
      ? userHasAccessToAllTenantsProp
      : defaultUserHasAccessToAllTenants

  if (!payloadProp) {
    return <>{children}</>
  }

  const tenantOptions = await getTenantOptions({
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
  let initialValue: string | number | undefined
  if (tenantCookie) {
    const match = tenantOptions.find((o) => String(o.value) === tenantCookie)
    initialValue = match?.value
  } else {
    initialValue = undefined
  }
  if (initialValue == null) {
    initialValue = tenantOptions.length > 1 ? undefined : tenantOptions[0]?.value
  }

  return (
    <TenantSelectionProviderRootAwareClient
      initialTenantOptions={tenantOptions}
      initialValue={initialValue}
      tenantsCollectionSlug={tenantsCollectionSlug}
    >
      {children}
    </TenantSelectionProviderRootAwareClient>
  )
}

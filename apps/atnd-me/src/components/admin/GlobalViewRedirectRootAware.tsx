import type { CollectionSlug, ServerProps, ViewTypes } from 'payload'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getGlobalViewRedirect } from '@payloadcms/plugin-multi-tenant/rsc'
import { parseCookies } from 'payload'
import { isNumber } from 'payload/shared'

/**
 * Collections that support a "root" document (tenant = null) for the root site.
 * When the tenant selector is cleared, we allow staying on the root doc instead
 * of redirecting to the first tenant's doc (which would show empty form data).
 */
const ROOT_DOC_COLLECTIONS: CollectionSlug[] = ['footer', 'navbar']

function getTenantFromCookie(headers: Headers, idType: 'number' | 'text'): string | number | null {
  const cookies = parseCookies(headers)
  const selectedTenant = cookies.get('payload-tenant') ?? null
  if (!selectedTenant) return null
  if (idType === 'number' && isNumber(selectedTenant)) {
    return parseFloat(selectedTenant)
  }
  return selectedTenant
}

type Args = {
  basePath?: string
  collectionSlug: CollectionSlug
  docID?: number | string
  globalSlugs: string[]
  tenantArrayFieldName: string
  tenantArrayTenantFieldName: string
  tenantFieldName: string
  tenantsCollectionSlug: string
  useAsTitle: string
  userHasAccessToAllTenants: (user: unknown) => Promise<boolean> | boolean
  viewType: ViewTypes
} & ServerProps

/**
 * Wraps the multi-tenant plugin's GlobalViewRedirect. For footer and navbar,
 * when no tenant is selected (cookie empty), allows staying on the current
 * document if it is the root document (tenant = null). This prevents the
 * form from being cleared after save when editing the root footer/navbar.
 */
export const GlobalViewRedirectRootAware = async (args: Args): Promise<void> => {
  const {
    collectionSlug,
    docID,
    globalSlugs,
    payload,
    tenantFieldName,
    tenantsCollectionSlug,
    ...rest
  } = args

  if (!collectionSlug || !globalSlugs?.includes(collectionSlug)) {
    return
  }

  const headers = await getHeaders()

  // For footer/navbar: when no tenant is selected, check if current doc is the root doc
  if (ROOT_DOC_COLLECTIONS.includes(collectionSlug) && docID) {
    const tenantsColl = payload.collections[tenantsCollectionSlug as CollectionSlug]
    const idType = tenantsColl?.customIDType ?? payload.db.defaultIDType
    const tenantFromCookie = getTenantFromCookie(headers, idType as 'number' | 'text')

    if (tenantFromCookie == null || tenantFromCookie === '') {
      try {
        const doc = await payload.findByID({
          collection: collectionSlug,
          id: docID,
          depth: 0,
          overrideAccess: true,
        })
        const docRecord = doc as unknown as Record<string, unknown> | null | undefined
        const docTenant = docRecord?.[tenantFieldName]
        const isRootDoc =
          docTenant == null ||
          (typeof docTenant === 'object' &&
            docTenant !== null &&
            (docTenant as { id?: unknown }).id == null)

        if (doc && isRootDoc) {
          // Stay on this document; do not redirect
          return
        }
      } catch {
        // If fetch fails, fall through to plugin behavior
      }
    }
  }

  const redirectRoute = await getGlobalViewRedirect({
    slug: collectionSlug,
    basePath: args.basePath,
    docID,
    headers,
    payload,
    tenantFieldName,
    tenantsArrayFieldName: args.tenantArrayFieldName,
    tenantsArrayTenantFieldName: args.tenantArrayTenantFieldName,
    tenantsCollectionSlug,
    useAsTitle: args.useAsTitle,
    user: args.user,
    userHasAccessToAllTenants: args.userHasAccessToAllTenants as (user: unknown) => boolean,
    view: args.viewType,
  })

  if (redirectRoute) {
    redirect(redirectRoute)
  }
}

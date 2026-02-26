import type { CollectionSlug, ViewTypes } from 'payload'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getGlobalViewRedirect } from '@payloadcms/plugin-multi-tenant/rsc'
import { parseCookies } from 'payload'
import { isNumber } from 'payload/shared'

const ROOT_DOC_COLLECTIONS_DEFAULT: string[] = ['footer', 'navbar']

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
  payload?: unknown
  user?: unknown
  rootDocCollections?: string[]
}

/**
 * Wraps the multi-tenant plugin's GlobalViewRedirect. For root-doc collections (e.g. navbar, footer),
 * when no tenant is selected, allows staying on the current document if it is the root document.
 */
export async function GlobalViewRedirectRootAware(args: Args): Promise<void> {
  const {
    collectionSlug,
    docID,
    globalSlugs,
    payload,
    tenantFieldName,
    tenantsCollectionSlug,
    rootDocCollections = ROOT_DOC_COLLECTIONS_DEFAULT,
  } = args

  if (!collectionSlug || !globalSlugs?.includes(collectionSlug)) {
    return
  }

  const headers = await getHeaders()

  if (rootDocCollections.includes(collectionSlug) && docID && payload) {
    const p = payload as {
      collections: Record<
        string,
        { config?: { customIDType?: string }; customIDType?: string }
      >
      db: { defaultIDType?: string }
      findByID: (opts: unknown) => Promise<unknown>
    }
    const tenantsColl = p.collections?.[tenantsCollectionSlug]
    const idType = (tenantsColl?.config?.customIDType ??
      tenantsColl?.customIDType ??
      p.db?.defaultIDType) as 'number' | 'text' | undefined
    const tenantFromCookie = idType ? getTenantFromCookie(headers, idType) : null

    if (tenantFromCookie == null || tenantFromCookie === '') {
      try {
        const doc = await p.findByID({
          collection: collectionSlug,
          id: docID,
          depth: 0,
          overrideAccess: true,
        })
        const docRecord = doc as Record<string, unknown> | null | undefined
        const docTenant = docRecord?.[tenantFieldName]
        const isRootDoc =
          docTenant == null ||
          (typeof docTenant === 'object' &&
            docTenant !== null &&
            (docTenant as { id?: unknown }).id == null)

        if (doc && isRootDoc) {
          return
        }
      } catch {
        // fall through
      }
    }
  }

  const redirectRoute = await getGlobalViewRedirect({
    slug: collectionSlug,
    basePath: args.basePath,
    docID,
    headers,
    payload: args.payload,
    tenantFieldName,
    tenantsArrayFieldName: args.tenantArrayFieldName,
    tenantsArrayTenantFieldName: args.tenantArrayTenantFieldName,
    tenantsCollectionSlug,
    useAsTitle: args.useAsTitle,
    user: args.user,
    userHasAccessToAllTenants: args.userHasAccessToAllTenants as (user: unknown) => boolean,
    view: args.viewType,
  } as Parameters<typeof getGlobalViewRedirect>[0])

  if (redirectRoute) {
    redirect(redirectRoute)
  }
}


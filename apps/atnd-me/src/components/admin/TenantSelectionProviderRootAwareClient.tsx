'use client'

/**
 * Root-aware tenant selection provider. Same as the plugin's TenantSelectionProviderClient
 * except we do NOT auto-set the first tenant when entityType === 'global' when the user is
 * on the navbar or footer collection (so they can edit the root navbar/footer without
 * being switched to the first tenant's doc and losing the form).
 *
 * When the user is on a create page for a collection that requires a tenant (see
 * COLLECTIONS_REQUIRE_TENANT_ON_CREATE) with no tenant selected, we show a modal to
 * select a tenant instead of redirecting. Collections where tenant is optional
 * (e.g. pages for root domain) are excluded so you can still create base pages without
 * selecting a tenant.
 */
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { toast, useAuth, useConfig } from '@payloadcms/ui'
import { usePathname, useRouter } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React, { createContext } from 'react'
import { PreventEnterSubmitOnCreatePage } from '@/components/admin/PreventEnterSubmitOnCreatePage'
import { SelectTenantForCreateModal } from '@/components/admin/SelectTenantForCreateModal'
import {
  getAdminURLForTenantSlug,
  getCurrentSubdomain,
  isOnAdminSubdomain,
} from '@/components/admin/admin-subdomain-redirect'
import { getPayloadTenantCookieDomain } from '@/components/admin/payload-tenant-cookie-domain'
import {
  COLLECTIONS_REQUIRE_TENANT_ON_CREATE,
  isTenantRequiredCreatePath,
} from '@/components/admin/prevent-create-page-reload'

const ROOT_DOC_PATHS = ['/collections/navbar', '/collections/footer']

export type TenantOption = { label: string; value: number | string; slug?: string }

const Context = createContext<{
  entityType?: 'document' | 'global'
  modified?: boolean
  options: TenantOption[]
  selectedTenantID: string | number | undefined
  setEntityType: React.Dispatch<React.SetStateAction<'document' | 'global' | undefined>>
  setModified: (value: boolean) => void
  setTenant: (args: { id?: string | number; refresh?: boolean }) => void
  syncTenants: () => Promise<void>
  updateTenants: (args: { id: string | number; label: string }) => void
}>({
  entityType: undefined,
  modified: false,
  options: [],
  selectedTenantID: undefined,
  setEntityType: () => undefined,
  setModified: () => undefined,
  setTenant: () => undefined,
  syncTenants: () => Promise.resolve(),
  updateTenants: () => undefined,
})

const COOKIE_NAME = 'payload-tenant'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function getCookieDomainAttr(): string {
  const domain = getPayloadTenantCookieDomain()
  return domain ? `; Domain=${domain}` : ''
}

function setTenantCookie(value: string) {
  const domainAttr = getCookieDomainAttr()
  const base = `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${domainAttr}`
  document.cookie = `${base}; Path=/`
  document.cookie = `${base}; Path=/admin`
  document.cookie = `${base}; Path=/admin/`
}

function deleteTenantCookie() {
  const domainAttr = getCookieDomainAttr()
  const base = `${COOKIE_NAME}=; Max-Age=0; SameSite=Lax${domainAttr}`
  document.cookie = `${base}; Path=/`
  document.cookie = `${base}; Path=/admin`
  document.cookie = `${base}; Path=/admin/`
}

function getTenantCookie(): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match?.[1] != null ? decodeURIComponent(match[1]) : undefined
}

export function TenantSelectionProviderRootAwareClient({
  children,
  initialTenantOptions,
  initialValue,
  tenantsCollectionSlug,
}: {
  children: React.ReactNode
  initialTenantOptions: TenantOption[]
  initialValue: string | number | undefined
  tenantsCollectionSlug: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [selectedTenantID, setSelectedTenantID] = React.useState(initialValue)
  const [modified, setModified] = React.useState(false)
  const [entityType, setEntityType] = React.useState<'document' | 'global' | undefined>(undefined)
  const { user } = useAuth()
  const { config } = useConfig()
  const userID = user?.id
  const prevUserID = React.useRef(userID)
  const userChanged = userID !== prevUserID.current
  const hasSyncedForUser = React.useRef(false)
  const hasAppliedInitialTenant = React.useRef(false)
  const [tenantOptions, setTenantOptions] = React.useState(initialTenantOptions)

  const findTenantOption = React.useCallback(
    (id: string | number | undefined) => {
      if (id === undefined || id === null || id === '') return undefined
      return tenantOptions.find((o) => String(o.value) === String(id))
    },
    [tenantOptions],
  )

  const isOnRootDocCollection =
    typeof pathname === 'string' && ROOT_DOC_PATHS.some((p) => pathname.includes(p))

  const isOnDashboard =
    typeof pathname === 'string' && (pathname === '/admin' || pathname === '/admin/')

  // Skip router.refresh() only on create pages for collections that require a tenant
  // (lessons, instructors, etc.) so the form is not cleared when the provider re-runs on mobile.
  // On create pages where tenant can be cleared (e.g. pages), we allow refresh so the UI
  // updates when the user clears the tenant.
  const isOnTenantRequiredCreatePage = isTenantRequiredCreatePath(pathname)

  const setTenantAndCookie = React.useCallback(
    ({ id, refresh }: { id?: string | number; refresh?: boolean }) => {
      const matched = findTenantOption(id)
      const canonicalId = matched?.value ?? id
      setSelectedTenantID(canonicalId)

      if (canonicalId !== undefined && canonicalId !== null && canonicalId !== '') {
        setTenantCookie(String(canonicalId))
      } else {
        deleteTenantCookie()
      }

      // On subdomain, keep URL in sync with selected tenant so tenant-slug and payload-tenant match.
      // Redirect to the selected tenant's subdomain (or root when clearing) to avoid a broken dashboard.
      if (isOnAdminSubdomain()) {
        const desiredSlug =
          canonicalId == null || canonicalId === ''
            ? null
            : (tenantOptions.find((o) => String(o.value) === String(canonicalId))?.slug ?? undefined)
        const currentSubdomain = getCurrentSubdomain()
        const slugMismatch =
          desiredSlug === undefined
            ? false
            : (desiredSlug ?? null) !== (currentSubdomain ?? null)
        if (slugMismatch) {
          window.location.href = getAdminURLForTenantSlug(desiredSlug ?? null)
          return
        }
      }

      // Skip refresh on tenant-required create pages and on root doc (navbar/footer) to avoid
      // clearing the form when editing navbar/footer, especially on subdomain where initialValue
      // can be temporarily out of sync with the cookie.
      if (refresh && !isOnTenantRequiredCreatePage && !isOnRootDocCollection) {
        router.refresh()
      }
    },
    [router, findTenantOption, isOnTenantRequiredCreatePage, isOnRootDocCollection, tenantOptions],
  )

  const setTenant = React.useCallback(
    ({ id, refresh }: { id?: string | number; refresh?: boolean }) => {
      if (id === undefined || id === null || id === '') {
        // Always clear when user explicitly clears; do not fall back to first tenant.
        setTenantAndCookie({ id: undefined, refresh })
      } else if (!tenantOptions.find((o) => String(o.value) === String(id))) {
        setTenantAndCookie({ id: tenantOptions[0]?.value, refresh })
      } else {
        setTenantAndCookie({ id, refresh })
      }
    },
    [tenantOptions, setTenantAndCookie],
  )

  const syncTenants = React.useCallback(async () => {
    try {
      const res = await fetch(
        formatAdminURL({
          apiRoute: config.routes.api,
          path: `/${tenantsCollectionSlug ?? 'tenants'}/populate-tenant-options`,
        }),
        { credentials: 'include', method: 'GET' },
      )
      const result = await res.json()
      if (result.tenantOptions && userID) {
        setTenantOptions(result.tenantOptions)
        if (result.tenantOptions.length === 1) {
          setSelectedTenantID(result.tenantOptions[0].value)
          setTenantCookie(String(result.tenantOptions[0].value))
        }
      }
    } catch {
      toast.error('Error fetching tenants')
    }
  }, [config.routes.api, tenantsCollectionSlug, userID])

  const syncTenantsRef = React.useRef(syncTenants)
  syncTenantsRef.current = syncTenants

  const updateTenants = React.useCallback(
    ({ id, label }: { id: string | number; label: string }) => {
      setTenantOptions((prev) =>
        prev.map((o) => (o.value === id ? { ...o, label } : o)),
      )
      void syncTenants()
    },
    [syncTenants],
  )

  React.useEffect(() => {
    if (userChanged) {
      hasSyncedForUser.current = false
      hasAppliedInitialTenant.current = false
    }
    const cookieMismatch =
      initialValue != null && String(initialValue) !== getTenantCookie()
    const shouldSync =
      (userChanged || cookieMismatch) && !hasSyncedForUser.current
    if (shouldSync) {
      if (userID) {
        hasSyncedForUser.current = true
        void syncTenantsRef.current()
      } else {
        setSelectedTenantID(undefined)
        deleteTenantCookie()
        if (tenantOptions.length > 0) setTenantOptions([])
        router.refresh()
      }
      prevUserID.current = userID
    }
    // Intentionally omit syncTenants from deps: we use syncTenantsRef.current() so this
    // effect only runs when user/cookie state changes, not when callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userID, userChanged, initialValue, router])

  React.useEffect(() => {
    if (
      (initialValue == null || initialValue === '') &&
      !hasAppliedInitialTenant.current
    ) {
      hasAppliedInitialTenant.current = true
      setTenant({ id: undefined, refresh: true })
    }
  }, [initialValue, setTenant])

  // Only auto-set first tenant when global if we're NOT on navbar/footer (root doc collections)
  React.useEffect(() => {
    if (!selectedTenantID && tenantOptions.length > 0 && entityType === 'global') {
      // Allow "All tenants" on dashboard; only auto-select on other global views.
      if (!isOnRootDocCollection && !isOnDashboard) {
        setTenant({ id: tenantOptions[0]?.value, refresh: true })
      }
    }
  }, [selectedTenantID, tenantOptions, entityType, isOnRootDocCollection, isOnDashboard, setTenant])

  // Show tenant-selection modal on create page when no tenant selected (instead of redirecting).
  const [showSelectTenantModal, setShowSelectTenantModal] = React.useState(false)
  const [createModalCollectionSlug, setCreateModalCollectionSlug] = React.useState<string | null>(
    null,
  )
  const createModalShownForPath = React.useRef<string | null>(null)

  // Only admins need the "filter by tenant" modal; tenant-admins have their tenant(s) assigned and should not see it.
  const isAdminUser = Boolean(user && checkRole(['admin'], user as unknown as SharedUser))
  const isTenantAdminUser =
    Boolean(user) &&
    checkRole(['tenant-admin'], user as unknown as SharedUser) &&
    !checkRole(['admin'], user as unknown as SharedUser)

  // When tenant-admin has only one tenant, default to it so they never see an empty tenant state.
  React.useEffect(() => {
    if (!isTenantAdminUser || tenantOptions.length !== 1) return
    const singleTenantId = tenantOptions[0]?.value
    if (singleTenantId == null) return
    const current = selectedTenantID
    if (current === undefined || current === null || current === '' || String(current) !== String(singleTenantId)) {
      setTenant({ id: singleTenantId, refresh: false })
    }
  }, [isTenantAdminUser, tenantOptions, selectedTenantID, setTenant])

  React.useEffect(() => {
    if (typeof pathname !== 'string') return
    const createMatch = pathname.match(/\/collections\/([^/]+)\/create$/)
    const collectionSlug = createMatch?.[1]
    const noTenant =
      selectedTenantID === undefined || selectedTenantID === null || selectedTenantID === ''

    if (
      collectionSlug &&
      COLLECTIONS_REQUIRE_TENANT_ON_CREATE.has(collectionSlug) &&
      noTenant &&
      isAdminUser
    ) {
      // If we have tenant options, show the modal so the admin can pick a tenant (tenant-admins never see this).
      if (tenantOptions.length > 0) {
        if (createModalShownForPath.current !== pathname) {
          createModalShownForPath.current = pathname
          setCreateModalCollectionSlug(collectionSlug)
          setShowSelectTenantModal(true)
        }
      } else {
        // No tenants available: redirect and toast (same as before).
        const listPath = pathname.replace(/\/create$/, '')
        router.replace(listPath)
        toast.error('Please select a tenant first, then create a new document.')
      }
    } else {
      createModalShownForPath.current = null
      setShowSelectTenantModal(false)
      setCreateModalCollectionSlug(null)
    }
  }, [pathname, selectedTenantID, tenantOptions.length, router, isAdminUser])

  const closeSelectTenantModal = React.useCallback(() => {
    setShowSelectTenantModal(false)
    setCreateModalCollectionSlug(null)
    createModalShownForPath.current = null
  }, [])

  return (
    <Context.Provider
      value={{
        entityType,
        modified,
        options: tenantOptions,
        selectedTenantID,
        setEntityType,
        setModified,
        setTenant,
        syncTenants,
        updateTenants,
      }}
    >
      <PreventEnterSubmitOnCreatePage />
      {children}
      <SelectTenantForCreateModal
        collectionSlug={createModalCollectionSlug ?? ''}
        isOpen={showSelectTenantModal}
        onClose={closeSelectTenantModal}
      />
    </Context.Provider>
  )
}

/** Drop-in replacement for plugin's useTenantSelection when using TenantSelectionProviderRootAware */
export const useTenantSelection = () => React.use(Context)

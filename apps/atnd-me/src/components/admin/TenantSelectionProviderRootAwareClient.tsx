'use client'

/**
 * Root-aware tenant selection provider. Same as the plugin's TenantSelectionProviderClient
 * except we do NOT auto-set the first tenant when entityType === 'global' when the user is
 * on the navbar or footer collection (so they can edit the root navbar/footer without
 * being switched to the first tenant's doc and losing the form).
 *
 * When the user is on a create page for a collection that requires a tenant (see
 * COLLECTIONS_REQUIRE_TENANT_ON_CREATE) with no tenant selected, we redirect to the list
 * and show a toast. Collections where tenant is optional (e.g. pages for root domain)
 * are excluded so you can still create base pages without selecting a tenant.
 */
import { toast, useAuth, useConfig } from '@payloadcms/ui'
import { usePathname, useRouter } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React, { createContext } from 'react'

const ROOT_DOC_PATHS = ['/collections/navbar', '/collections/footer']

/**
 * Collection slugs where a tenant is required when creating a new document.
 * The redirect (and toast) only runs for these collections, so we preserve:
 * - pages: create base/root domain pages without selecting a tenant (tenant optional).
 * - navbar, footer: create root globals (handled as globals, not collection create routes).
 * Only collections that truly require a tenant for create are listed here.
 */
const COLLECTIONS_REQUIRE_TENANT_ON_CREATE = new Set([
  'lessons',
  'instructors',
  'class-options',
  'bookings',
  'class-pass-types',
  'class-passes',
  'transactions',
  'drop-ins',
  'plans',
  'discount-codes',
  'subscriptions',
  'forms',
  'form-submissions',
  'scheduler',
])

const Context = createContext<{
  entityType?: 'document' | 'global'
  modified?: boolean
  options: { label: string; value: number | string }[]
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

function setTenantCookie(value: string) {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/admin; Max-Age=${maxAge}; SameSite=Lax`
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/admin/; Max-Age=${maxAge}; SameSite=Lax`
}

function deleteTenantCookie() {
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`
  document.cookie = `${COOKIE_NAME}=; Path=/admin; Max-Age=0; SameSite=Lax`
  document.cookie = `${COOKIE_NAME}=; Path=/admin/; Max-Age=0; SameSite=Lax`
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
  initialTenantOptions: { label: string; value: number | string }[]
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
      if (refresh) {
        router.refresh()
      }
    },
    [router, findTenantOption],
  )

  const setTenant = React.useCallback(
    ({ id, refresh }: { id?: string | number; refresh?: boolean }) => {
      if (id === undefined || id === null || id === '') {
        if (tenantOptions.length > 1 || tenantOptions.length === 0) {
          setTenantAndCookie({ id: undefined, refresh })
        } else if (tenantOptions[0]) {
          setTenantAndCookie({ id: tenantOptions[0].value, refresh: true })
        }
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

  // Redirect from create page when no tenant selected for tenant-scoped collections.
  // Prevents the admin from becoming unclickable when create form loads without tenant context.
  const createRedirectApplied = React.useRef(false)
  React.useEffect(() => {
    if (typeof pathname !== 'string') return
    const createMatch = pathname.match(/\/collections\/([^/]+)\/create$/)
    const collectionSlug = createMatch?.[1]
    if (
      collectionSlug &&
      COLLECTIONS_REQUIRE_TENANT_ON_CREATE.has(collectionSlug) &&
      (selectedTenantID === undefined || selectedTenantID === null || selectedTenantID === '')
    ) {
      if (!createRedirectApplied.current) {
        createRedirectApplied.current = true
        const listPath = pathname.replace(/\/create$/, '')
        router.replace(listPath)
        toast.error('Please select a tenant first, then create a new document.')
      }
    } else {
      createRedirectApplied.current = false
    }
  }, [pathname, selectedTenantID, router])

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
      {children}
    </Context.Provider>
  )
}

/** Drop-in replacement for plugin's useTenantSelection when using TenantSelectionProviderRootAware */
export const useTenantSelection = () => React.use(Context)

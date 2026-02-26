'use client'

import { toast, useAuth, useConfig } from '@payloadcms/ui'
import { usePathname, useRouter } from 'next/navigation'
import { formatAdminURL } from 'payload/shared'
import React, { createContext } from 'react'
import { createPathHelpers } from '../lib/pathHelpers'
import {
  getTenantCookie,
  deleteTenantCookie,
  setPayloadTenantCookie,
} from '../lib/cookieHelpers'
import { PreventEnterSubmitOnCreatePage } from './PreventEnterSubmitOnCreatePage'
import { SelectTenantForCreateModal } from './SelectTenantForCreateModal'

import type { TenantOption } from '../types'

type ContextValue = {
  entityType?: 'document' | 'global'
  modified?: boolean
  options: TenantOption[]
  selectedTenantID: string | number | undefined
  setEntityType: React.Dispatch<React.SetStateAction<'document' | 'global' | undefined>>
  setModified: (value: boolean) => void
  setTenant: (args: { id?: string | number; refresh?: boolean }) => void
  syncTenants: () => Promise<void>
  updateTenants: (args: { id: string | number; label: string }) => void
  rootDocCollections: string[]
  collectionsRequireTenantOnCreate: string[]
  collectionsCreateRequireTenantForTenantAdmin: string[]
  isTenantAdminOnly?: (user: unknown) => boolean
}

const DefaultContext: ContextValue = {
  entityType: undefined,
  modified: false,
  options: [],
  selectedTenantID: undefined,
  setEntityType: () => undefined,
  setModified: () => undefined,
  setTenant: () => undefined,
  syncTenants: () => Promise.resolve(),
  updateTenants: () => undefined,
  rootDocCollections: ['navbar', 'footer'],
  collectionsRequireTenantOnCreate: [],
  collectionsCreateRequireTenantForTenantAdmin: ['pages', 'navbar', 'footer'],
}

const Context = createContext<ContextValue>(DefaultContext)

export function useTenantSelection() {
  return React.useContext(Context)
}

type Props = {
  children: React.ReactNode
  initialTenantOptions: TenantOption[]
  initialValue: string | number | undefined
  tenantsCollectionSlug: string
  rootDocCollections?: string[]
  collectionsRequireTenantOnCreate?: string[]
  collectionsCreateRequireTenantForTenantAdmin?: string[]
  getCookieDomain?: () => string | undefined
  userHasAccessToAllTenants?: (user: unknown) => boolean | Promise<boolean>
}

export function TenantSelectionProviderRootAwareClient({
  children,
  initialTenantOptions,
  initialValue,
  tenantsCollectionSlug,
  rootDocCollections = ['navbar', 'footer'],
  collectionsRequireTenantOnCreate = [],
  collectionsCreateRequireTenantForTenantAdmin = ['pages', 'navbar', 'footer'],
  getCookieDomain,
}: Props) {
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

  const pathHelpers = React.useMemo(
    () =>
      createPathHelpers({
        collectionsRequireTenantOnCreate,
        collectionsCreateRequireTenantForTenantAdmin,
      }),
    [collectionsRequireTenantOnCreate, collectionsCreateRequireTenantForTenantAdmin],
  )
  const isTenantRequiredCreatePath = pathHelpers.isTenantRequiredCreatePath
  const isCreateRequireTenantForTenantAdminPath = pathHelpers.isCreateRequireTenantForTenantAdminPath

  const rootDocPaths = React.useMemo(
    () => rootDocCollections.map((slug) => `/collections/${slug}`),
    [rootDocCollections],
  )
  const isOnRootDocCollection =
    typeof pathname === 'string' && rootDocPaths.some((p) => pathname.includes(p))
  const isOnDashboard =
    typeof pathname === 'string' && (pathname === '/admin' || pathname === '/admin/')
  const isOnTenantRequiredCreatePage = isTenantRequiredCreatePath(pathname)

  const findTenantOption = React.useCallback(
    (id: string | number | undefined) => {
      if (id === undefined || id === null || id === '') return undefined
      return tenantOptions.find((o) => String(o.value) === String(id))
    },
    [tenantOptions],
  )

  const setTenantAndCookie = React.useCallback(
    ({ id, refresh }: { id?: string | number; refresh?: boolean }) => {
      const matched = findTenantOption(id)
      const canonicalId = matched?.value ?? id
      setSelectedTenantID(canonicalId)

      if (canonicalId !== undefined && canonicalId !== null && canonicalId !== '') {
        setPayloadTenantCookie(String(canonicalId), getCookieDomain)
      } else {
        deleteTenantCookie(getCookieDomain)
      }

      if (refresh && !isOnTenantRequiredCreatePage && !isOnRootDocCollection) {
        router.refresh()
      }
    },
    [router, findTenantOption, isOnTenantRequiredCreatePage, isOnRootDocCollection, tenantOptions],
  )

  const setTenant = React.useCallback(
    ({ id, refresh }: { id?: string | number; refresh?: boolean }) => {
      if (id === undefined || id === null || id === '') {
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
          setPayloadTenantCookie(String(result.tenantOptions[0].value), getCookieDomain)
        }
      }
    } catch {
      toast.error('Error fetching tenants')
    }
  }, [config.routes.api, tenantsCollectionSlug, userID, getCookieDomain])

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
        deleteTenantCookie(getCookieDomain)
        if (tenantOptions.length > 0) setTenantOptions([])
        router.refresh()
      }
      prevUserID.current = userID
    }
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

  React.useEffect(() => {
    if (!selectedTenantID && tenantOptions.length > 0 && entityType === 'global') {
      if (!isOnRootDocCollection && !isOnDashboard) {
        setTenant({ id: tenantOptions[0]?.value, refresh: true })
      }
    }
  }, [selectedTenantID, tenantOptions, entityType, isOnRootDocCollection, isOnDashboard, setTenant])

  const [showSelectTenantModal, setShowSelectTenantModal] = React.useState(false)
  const [createModalCollectionSlug, setCreateModalCollectionSlug] = React.useState<string | null>(
    null,
  )
  const createModalShownForPath = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (typeof pathname !== 'string') return
    if (!isTenantRequiredCreatePath(pathname)) return
    if (selectedTenantID !== undefined && selectedTenantID !== null && selectedTenantID !== '') return
    const cookie = getTenantCookie()
    if (!cookie) return
    const match = tenantOptions.find((o) => String(o.value) === cookie)
    if (match) {
      setSelectedTenantID(match.value)
      router.refresh()
    }
  }, [pathname, selectedTenantID, tenantOptions, router, isTenantRequiredCreatePath])

  const isAdminUser = Boolean(
    user && (user as { roles?: string[] })?.roles?.includes?.('admin'),
  )
  const isTenantAdminUser =
    Boolean(user) &&
    (user as { roles?: string[] })?.roles?.includes?.('tenant-admin') === true &&
    !(user as { roles?: string[] })?.roles?.includes?.('admin')

  React.useEffect(() => {
    if (!isTenantAdminUser || tenantOptions.length !== 1) return
    const singleTenantId = tenantOptions[0]?.value
    if (singleTenantId == null) return
    const current = selectedTenantID
    if (
      current === undefined ||
      current === null ||
      current === '' ||
      String(current) !== String(singleTenantId)
    ) {
      setTenant({ id: singleTenantId, refresh: false })
    }
  }, [isTenantAdminUser, tenantOptions, selectedTenantID, setTenant])

  React.useLayoutEffect(() => {
    if (typeof pathname !== 'string') return
    if (!isCreateRequireTenantForTenantAdminPath(pathname)) return
    if (!isTenantAdminUser) return
    const noTenant =
      selectedTenantID === undefined || selectedTenantID === null || selectedTenantID === ''
    if (!noTenant) return
    if (tenantOptions.length === 1) return
    const createMatch = pathname.match(/\/collections\/([^/]+)\/create$/)
    const collectionSlug = createMatch?.[1]
    if (!collectionSlug) return
    if (tenantOptions.length > 1) {
      if (createModalShownForPath.current !== pathname) {
        createModalShownForPath.current = pathname
        setCreateModalCollectionSlug(collectionSlug)
        setShowSelectTenantModal(true)
      }
    } else {
      const listPath = pathname.replace(/\/create$/, '')
      router.replace(listPath)
      toast.error(
        'You must select a tenant to create a document. Base/root documents (no tenant) are only available to administrators.',
      )
    }
  }, [pathname, isTenantAdminUser, selectedTenantID, tenantOptions.length, router])

  React.useLayoutEffect(() => {
    if (typeof pathname !== 'string') return
    const createMatch = pathname.match(/\/collections\/([^/]+)\/create$/)
    const collectionSlug = createMatch?.[1]
    const noTenant =
      selectedTenantID === undefined || selectedTenantID === null || selectedTenantID === ''

    const requireSet = new Set(collectionsRequireTenantOnCreate)
    const requireTenantAdminSet = new Set(collectionsCreateRequireTenantForTenantAdmin)
    const isTenantRequiredCreate =
      collectionSlug &&
      requireSet.has(collectionSlug) &&
      noTenant &&
      (isAdminUser || isTenantAdminUser)
    const isCreateRequireTenantForTenantAdmin =
      collectionSlug &&
      requireTenantAdminSet.has(collectionSlug) &&
      isTenantAdminUser &&
      noTenant &&
      tenantOptions.length > 1

    if (isTenantRequiredCreate) {
      if (tenantOptions.length > 0) {
        if (createModalShownForPath.current !== pathname) {
          createModalShownForPath.current = pathname
          setCreateModalCollectionSlug(collectionSlug!)
          setShowSelectTenantModal(true)
        }
      } else {
        const listPath = pathname.replace(/\/create$/, '')
        router.replace(listPath)
        toast.error('Please select a tenant first, then create a new document.')
      }
    } else if (isCreateRequireTenantForTenantAdmin) {
      if (createModalShownForPath.current !== pathname) {
        createModalShownForPath.current = pathname
        setCreateModalCollectionSlug(collectionSlug!)
        setShowSelectTenantModal(true)
      }
    } else {
      createModalShownForPath.current = null
      setShowSelectTenantModal(false)
      setCreateModalCollectionSlug(null)
    }
  }, [
    pathname,
    selectedTenantID,
    tenantOptions.length,
    router,
    isAdminUser,
    isTenantAdminUser,
    collectionsRequireTenantOnCreate,
    collectionsCreateRequireTenantForTenantAdmin,
  ])

  const closeSelectTenantModal = React.useCallback(() => {
    setShowSelectTenantModal(false)
    setCreateModalCollectionSlug(null)
    createModalShownForPath.current = null
  }, [])

  const value: ContextValue = {
    ...DefaultContext,
    entityType,
    modified,
    options: tenantOptions,
    selectedTenantID,
    setEntityType,
    setModified,
    setTenant,
    syncTenants,
    updateTenants,
    rootDocCollections,
    collectionsRequireTenantOnCreate,
    collectionsCreateRequireTenantForTenantAdmin,
  }

  return (
    <Context.Provider value={value}>
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

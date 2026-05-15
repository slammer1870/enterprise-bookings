'use client'

import type { ReactSelectOption } from '@payloadcms/ui'
import { SelectInput } from '@payloadcms/ui'
import React from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import {
  getPayloadLocationCookie,
  setPayloadLocationCookie,
} from '@repo/plugin-clearable-tenant'
import { useTenantSelection } from '@repo/plugin-clearable-tenant/client'

type ApiResponse = {
  tenantId: number | null
  locations: Array<{ id: number; name: string; slug: string }>
}

type PayloadLocationChangeEvent = CustomEvent<{ locationId: number | null }>

/**
 * Routes where branch filtering is meaningful.
 * The selector is hidden on all other admin pages to avoid confusion.
 */
const BRANCH_RELEVANT_PATHS = [
  /^\/admin(\/)?$/, // analytics dashboard
  /^\/admin\/collections\/timeslots(\/|$)/, // timeslots list / detail
  /^\/admin\/collections\/scheduler(\/|$)/, // scheduler list / detail
]

function isBranchRelevantPath(pathname: string): boolean {
  return BRANCH_RELEVANT_PATHS.some((re) => re.test(pathname))
}

const LOCATION_REQUIRED_CREATE_PATHS = [
  /^\/admin\/collections\/timeslots\/create(\/|$)/,
  /^\/admin\/collections\/scheduler\/create(\/|$)/,
]

function isLocationRequiredCreatePath(pathname: string): boolean {
  return LOCATION_REQUIRED_CREATE_PATHS.some((re) => re.test(pathname))
}

const LOCATION_SELECTOR_NO_ALL_SITES_PATHS = [
  // Timeslots create
  /^\/admin\/collections\/timeslots\/create(\/|$)/,
  // Timeslots edit
  /^\/admin\/collections\/timeslots\/[^/]+\/edit(\/|$)/,
  // Scheduler create
  /^\/admin\/collections\/scheduler\/create(\/|$)/,
  // Scheduler edit
  /^\/admin\/collections\/scheduler\/[^/]+\/edit(\/|$)/,
]

function isLocationSelectorNoAllSitesPath(pathname: string): boolean {
  return LOCATION_SELECTOR_NO_ALL_SITES_PATHS.some((re) => re.test(pathname))
}

/**
 * Admin sidebar: filter lists by branch (`payload-location`), mirroring tenant cookie paths.
 * Only rendered on routes where branch filtering is meaningful (timeslots, analytics dashboard).
 */
export default function AdminBranchSiteSelector() {
  const pathname = usePathname()
  const router = useRouter()
  const { selectedTenantID } = useTenantSelection()
  const [rows, setRows] = React.useState<ApiResponse['locations']>([])
  const [loading, setLoading] = React.useState(true)
  const [value, setValue] = React.useState<ReactSelectOption | undefined>(() => {
    const raw = getPayloadLocationCookie()?.trim()
    if (raw && /^\d+$/.test(raw)) {
      return { label: raw, value: raw }
    }
    return { label: '', value: '' }
  })

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch('/api/admin/branch-selector-options', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setRows([])
          return
        }
        const data = (await res.json()) as ApiResponse
        if (cancelled) return
        setRows(Array.isArray(data.locations) ? data.locations : [])
        const cookieId = getPayloadLocationCookie()?.trim()
        const valid =
          cookieId &&
          /^\d+$/.test(cookieId) &&
          data.locations.some((l) => String(l.id) === cookieId)
        if (valid) {
          const loc = data.locations.find((l) => String(l.id) === cookieId)!
          setValue({ label: loc.name, value: String(loc.id) })
        } else {
          setValue({ label: '', value: '' })
        }
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedTenantID, pathname])

  // Keep selector UI in sync if some other form field sync updates the cookie
  // (e.g. autofilling the location cookie from the current timeslot branch on edit routes).
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as PayloadLocationChangeEvent
      const locationId = ce?.detail?.locationId ?? null

      if (locationId == null) {
        setValue({ label: '', value: '' })
        return
      }

      const loc = rows.find((l) => l.id === locationId)
      if (loc) {
        setValue({ label: loc.name, value: String(loc.id) })
      }
    }

    window.addEventListener('payload-location-change', handler as EventListener)
    return () => window.removeEventListener('payload-location-change', handler as EventListener)
  }, [rows])

  const options = React.useMemo((): ReactSelectOption[] => {
    const forceScoped = isLocationSelectorNoAllSitesPath(pathname ?? '')

    // On create/edit routes with multiple locations, do not allow selecting an unscoped value.
    const base: ReactSelectOption[] = forceScoped ? [] : [{ label: 'All sites', value: '' }]

    for (const loc of rows) {
      base.push({ label: loc.name, value: String(loc.id) })
    }
    return base
  }, [rows, pathname])

  const rawCookieId = getPayloadLocationCookie()?.trim()
  const cookieValid = Boolean(rawCookieId && /^\d+$/.test(rawCookieId))
  const showLocationModal =
    isLocationRequiredCreatePath(pathname ?? '') && !loading && !cookieValid && rows.length > 1

  // Prevent Enter-submit while the modal is open (mirrors PreventEnterSubmitOnCreatePage UX).
  React.useEffect(() => {
    if (!showLocationModal) return
    const onKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const el = document.activeElement
      if (!el || !(el instanceof HTMLElement)) return
      const tagName = el.tagName.toLowerCase()
      const isInputLike = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
      if (!isInputLike) return
      e.preventDefault()
      e.stopPropagation()
    }
    const onSubmitCapture = (e: Event) => {
      const ev = e as SubmitEvent
      if (ev.submitter == null) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener('keydown', onKeyDownCapture, true)
    document.addEventListener('submit', onSubmitCapture, true)
    return () => {
      document.removeEventListener('keydown', onKeyDownCapture, true)
      document.removeEventListener('submit', onSubmitCapture, true)
    }
  }, [showLocationModal])

  const isBranchSidebarVisible =
    pathname != null && typeof pathname === 'string' && isBranchRelevantPath(pathname)

  const closeModal = () => {
    // Route back to the list for the create form collection.
    const match = (pathname ?? '').match(/\/admin\/collections\/([^/]+)\/create(\/|$)/)
    const collectionSlug = match?.[1]
    router.replace(collectionSlug ? `/admin/collections/${collectionSlug}` : '/admin')
  }

  const [selectedLocationId, setSelectedLocationId] = React.useState<string | undefined>(undefined)
  React.useEffect(() => {
    if (!showLocationModal) {
      setSelectedLocationId(undefined)
      return
    }
    if (rows.length === 1) {
      setSelectedLocationId(String(rows[0]?.id ?? ''))
    }
  }, [showLocationModal, rows])

  if (loading) {
    return null
  }

  const handleChange = (opt: ReactSelectOption | ReactSelectOption[] | null | undefined) => {
    const single = Array.isArray(opt) ? opt[0] : opt
    const raw = single && typeof single === 'object' && 'value' in single ? String(single.value ?? '') : ''
    setPayloadLocationCookie(raw === '' ? undefined : raw)
    setValue(single ?? { label: '', value: '' })
    // For "create/edit" forms, preserve entered values by avoiding a hard reload.
    // We instead dispatch a custom event so form field sync components can update.
    const pathnameNow = window.location.pathname
    const isTimeslotsCreateOrEdit = /^\/admin\/collections\/timeslots(\/|$)/.test(pathnameNow) &&
      (/^\/admin\/collections\/timeslots\/create(\/|$)/.test(pathnameNow) ||
        /^\/admin\/collections\/timeslots\/[^/]+\/edit(\/|$)/.test(pathnameNow))

    const isSchedulerCreateOrEdit = /^\/admin\/collections\/scheduler(\/|$)/.test(pathnameNow) &&
      (/^\/admin\/collections\/scheduler\/create(\/|$)/.test(pathnameNow) ||
        /^\/admin\/collections\/scheduler\/[^/]+\/edit(\/|$)/.test(pathnameNow))

    const nextLocationId = raw && /^\d+$/.test(raw) ? Number(raw) : null
    window.dispatchEvent(
      new CustomEvent('payload-location-change', {
        detail: { locationId: nextLocationId },
      }),
    )

    if (isTimeslotsCreateOrEdit || isSchedulerCreateOrEdit) return

    // List pages: we can safely reload to ensure list filters + server data update.
    // When on a scheduler page (list or detail), navigate to the list so the
    // SchedulerListView can redirect to the correct location's scheduler document.
    if (/^\/admin\/collections\/scheduler(\/|$)/.test(pathnameNow)) {
      window.location.href = '/admin/collections/scheduler'
    } else {
      window.location.reload()
    }
  }

  return (
    <>
      {showLocationModal && typeof document !== 'undefined'
        ? createPortal(
            <div
              role="presentation"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2147483647,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
            >
              <div
                aria-hidden
                onMouseDown={() => closeModal()}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.55)',
                  zIndex: 0,
                }}
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="select-location-for-create-heading"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  width: 'min(560px, 92vw)',
                  background: 'var(--theme-elevation-0)',
                  border: '1px solid var(--theme-elevation-100)',
                  borderRadius: 8,
                  padding: 24,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
                }}
              >
                <h2
                  id="select-location-for-create-heading"
                  style={{
                    margin: 0,
                    marginBottom: 8,
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  Select site / branch
                </h2>
                <p style={{ margin: 0, marginBottom: 16 }}>
                  This tenant has multiple active locations. Choose which site this new document should be
                  created for.
                </p>

                <div style={{ marginBottom: 24 }}>
                  <label
                    htmlFor="select-location-create"
                    style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
                  >
                    Filter by location
                  </label>
                  <select
                    id="select-location-create"
                    name="select-location-create"
                    value={selectedLocationId == null ? '' : selectedLocationId}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setSelectedLocationId(nextValue === '' ? undefined : nextValue)
                    }}
                    style={{
                      width: '100%',
                      minHeight: 40,
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--theme-elevation-200)',
                      background: 'var(--theme-elevation-0)',
                      color: 'var(--theme-text)',
                    }}
                  >
                    <option value="">Select a site</option>
                    {rows.map((loc) => (
                      <option key={String(loc.id)} value={String(loc.id)}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{
                      minHeight: 40,
                      padding: '0 16px',
                      borderRadius: 4,
                      border: '1px solid var(--theme-elevation-200)',
                      background: 'var(--theme-elevation-50)',
                      color: 'var(--theme-text)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedLocationId == null || selectedLocationId === ''}
                    onClick={() => {
                      if (!selectedLocationId) return
                      setPayloadLocationCookie(selectedLocationId)
                      closeModal()
                      // Reload so create page hooks/access rules re-run with the new cookie.
                      if (typeof window !== 'undefined') window.location.reload()
                    }}
                    style={{
                      minHeight: 40,
                      padding: '0 16px',
                      borderRadius: 4,
                      border: '1px solid var(--theme-success-500)',
                      background: 'var(--theme-success-500)',
                      color: '#fff',
                      cursor:
                        selectedLocationId == null || selectedLocationId === ''
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        selectedLocationId == null || selectedLocationId === '' ? 0.7 : 1,
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isBranchSidebarVisible && rows.length > 1 ? (
        <div
          className="branch-site-selector"
          data-testid="branch-site-selector"
          style={{
            width: '100%',
            marginBottom: '1rem',
          }}
        >
          <SelectInput
            isClearable={false}
            label="Site / branch"
            name="branchSiteFilter"
            onChange={handleChange as (value: unknown) => void}
            options={options as Parameters<typeof SelectInput>[0]['options']}
            path="branchSiteFilter"
            readOnly={false}
            value={(value?.value === '' || value?.value == null ? undefined : value.value) as Parameters<
              typeof SelectInput
            >[0]['value']}
          />
        </div>
      ) : null}
    </>
  )
}

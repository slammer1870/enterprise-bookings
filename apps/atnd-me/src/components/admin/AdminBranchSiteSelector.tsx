'use client'

import type { ReactSelectOption } from '@payloadcms/ui'
import { SelectInput } from '@payloadcms/ui'
import React from 'react'
import { usePathname } from 'next/navigation'
import {
  getPayloadLocationCookie,
  setPayloadLocationCookie,
} from '@repo/plugin-clearable-tenant'
import { useTenantSelection } from '@repo/plugin-clearable-tenant/client'

type ApiResponse = {
  tenantId: number | null
  locations: Array<{ id: number; name: string; slug: string }>
}

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

/**
 * Admin sidebar: filter lists by branch (`payload-location`), mirroring tenant cookie paths.
 * Only rendered on routes where branch filtering is meaningful (timeslots, analytics dashboard).
 */
export default function AdminBranchSiteSelector() {
  const pathname = usePathname()
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

  const options = React.useMemo((): ReactSelectOption[] => {
    const base: ReactSelectOption[] = [{ label: 'All sites', value: '' }]
    for (const loc of rows) {
      base.push({ label: loc.name, value: String(loc.id) })
    }
    return base
  }, [rows])

  if (!isBranchRelevantPath(pathname ?? '')) {
    return null
  }

  if (loading || rows.length <= 1) {
    return null
  }

  const handleChange = (opt: ReactSelectOption | ReactSelectOption[] | null | undefined) => {
    const single = Array.isArray(opt) ? opt[0] : opt
    const raw = single && typeof single === 'object' && 'value' in single ? String(single.value ?? '') : ''
    setPayloadLocationCookie(raw === '' ? undefined : raw)
    setValue(single ?? { label: '', value: '' })
    // When on a scheduler page (list or detail), navigate to the list so the
    // SchedulerListView can redirect to the correct location's scheduler document.
    // For all other pages (timeslots, dashboard) reload the current URL.
    if (/^\/admin\/collections\/scheduler(\/|$)/.test(window.location.pathname)) {
      window.location.href = '/admin/collections/scheduler'
    } else {
      // Force full reload so Payload list queries re-run with the updated cookie.
      window.location.reload()
    }
  }

  return (
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
  )
}

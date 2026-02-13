'use client'

/**
 * When on the dashboard, shows the selected tenant in the sidebar with an X to clear
 * (same behaviour as the multi-tenant plugin's selector on collection pages).
 * Renders in beforeNavLinks so it appears in the sidebar.
 */
import React, { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type CurrentTenant = { tenantId: number; tenantName: string | null } | null

export const SidebarTenantChip: React.FC = () => {
  const pathname = usePathname()
  const router = useRouter()
  const [tenant, setTenant] = useState<CurrentTenant>(null)
  const [clearing, setClearing] = useState(false)

  const isDashboard =
    pathname === '/admin' ||
    pathname === '/admin/' ||
    (pathname?.startsWith('/admin') && pathname?.split('/').filter(Boolean).length <= 1)

  useEffect(() => {
    if (!isDashboard) {
      setTenant(null)
      return
    }
    let cancelled = false
    fetch('/api/admin/current-tenant', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { tenantId: null, tenantName: null }))
      .then((data: { tenantId: number | null; tenantName: string | null }) => {
        if (!cancelled && data.tenantId != null) {
          setTenant({ tenantId: data.tenantId, tenantName: data.tenantName })
        } else if (!cancelled) {
          setTenant(null)
        }
      })
      .catch(() => {
        if (!cancelled) setTenant(null)
      })
    return () => {
      cancelled = true
    }
  }, [isDashboard, pathname])

  const handleClear = async () => {
    setClearing(true)
    try {
      const res = await fetch('/api/admin/clear-tenant-cookie', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.ok) {
        setTenant(null)
        router.refresh()
      }
    } finally {
      setClearing(false)
    }
  }

  if (!isDashboard || !tenant) return null

  const label = tenant.tenantName || `Tenant ${tenant.tenantId}`

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.25rem',
        borderRadius: '4px',
        backgroundColor: 'var(--theme-elevation-150, #f0f0f0)',
        border: '1px solid var(--theme-elevation-250, #e5e5e5)',
        fontSize: '0.8125rem',
        color: 'var(--theme-elevation-800, #1a1a1a)',
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={handleClear}
        disabled={clearing}
        title="View all tenants"
        aria-label="View all tenants"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.25rem',
          height: '1.25rem',
          padding: 0,
          border: 'none',
          borderRadius: '2px',
          background: 'var(--theme-elevation-500, #737373)',
          color: 'white',
          cursor: clearing ? 'wait' : 'pointer',
          fontSize: '0.875rem',
          lineHeight: 1,
          flexShrink: 0,
          opacity: clearing ? 0.7 : 1,
        }}
      >
        ×
      </button>
    </div>
  )
}

export default SidebarTenantChip

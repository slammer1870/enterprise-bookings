'use client'

/**
 * Step 2.6 – Admin UX: "Connect Stripe" + connection status for tenant-admin.
 * Renders only for tenant-admin; shows "Stripe connected" or "Connect Stripe" link.
 */
import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { isTenantAdmin } from '@/utilities/check-admin-role'
import { getStripeConnectNoticeFromSearch } from '@/components/admin/stripeConnectNotice'

type Status = { connected: boolean; tenantSlug?: string } | null

export const StripeConnectStatus: React.FC = () => {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !isTenantAdmin(user)) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch('/api/stripe/connect/status', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('status failed'))))
      .then((data: { connected: boolean; tenantSlug?: string }) => {
        if (!cancelled) setStatus({ connected: data.connected, tenantSlug: data.tenantSlug })
      })
      .catch(() => {
        if (!cancelled) setStatus(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || !user || !isTenantAdmin(user)) {
    return null
  }
  if (status === null) {
    return null
  }
  const notice =
    typeof window !== 'undefined'
      ? getStripeConnectNoticeFromSearch(window.location.search, {
          connected: status?.connected,
        })
      : null
  if (status.connected) {
    return (
      <div data-testid="stripe-connect-status">
        {notice ? (
          <div
            data-testid="stripe-connect-notice"
            role={notice.tone === 'error' ? 'alert' : 'status'}
            style={{
              marginBottom: '8px',
              padding: '10px 12px',
              borderRadius: '4px',
              backgroundColor: notice.tone === 'error' ? '#fef2f2' : '#f0fdf4',
              color: notice.tone === 'error' ? '#b91c1c' : '#166534',
              border: `1px solid ${notice.tone === 'error' ? '#fecaca' : '#bbf7d0'}`,
            }}
          >
            {notice.message}
          </div>
        ) : null}
        <strong>Stripe connected</strong>
      </div>
    )
  }
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const href = status.tenantSlug
    ? `${base}/api/stripe/connect/authorize?tenantSlug=${encodeURIComponent(status.tenantSlug)}`
    : `${base}/api/stripe/connect/authorize`
  return (
    <div data-testid="stripe-connect-status">
      {notice ? (
        <div
          data-testid="stripe-connect-notice"
          role={notice.tone === 'error' ? 'alert' : 'status'}
          style={{
            marginBottom: '8px',
            padding: '10px 12px',
            borderRadius: '4px',
            backgroundColor: notice.tone === 'error' ? '#fef2f2' : '#f0fdf4',
            color: notice.tone === 'error' ? '#b91c1c' : '#166534',
            border: `1px solid ${notice.tone === 'error' ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          {notice.message}
        </div>
      ) : null}
      <a href={href}>Connect Stripe</a>
    </div>
  )
}

export default StripeConnectStatus

'use client'

/**
 * Step 2.6 – Admin UX: "Connect Stripe" + connection status for tenant-admin.
 * Renders only for tenant-admin; shows "Stripe connected" or "Connect Stripe" link.
 */
import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { isTenantAdmin } from '@/utilities/check-admin-role'

type Status = { connected: boolean; tenantSlug?: string } | null
type ConnectNotice = { tone: 'success' | 'error'; message: string } | null

function getConnectNotice(status: Status): ConnectNotice {
  if (typeof window === 'undefined') {
    return null
  }

  const searchParams = new URLSearchParams(window.location.search)
  const connectState = searchParams.get('stripe_connect')
  const rawMessage = searchParams.get('message')?.trim()

  if (connectState === 'success') {
    return {
      tone: 'success',
      message: status?.connected
        ? 'Stripe connected successfully.'
        : 'Stripe onboarding returned successfully. Final confirmation may take a moment.',
    }
  }

  if (connectState === 'error') {
    return {
      tone: 'error',
      message: rawMessage || 'Stripe onboarding could not be completed.',
    }
  }

  return null
}

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
  const notice = getConnectNotice(status)
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

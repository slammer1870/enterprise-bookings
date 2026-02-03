'use client'

/**
 * Step 2.6 – Admin UX: "Connect Stripe" + connection status for tenant-admin.
 * Renders only for tenant-admin; shows "Stripe connected" or "Connect Stripe" link.
 */
import React, { useEffect, useState } from 'react'
import { useAuth } from '@payloadcms/ui'
import { checkRole } from '@repo/shared-utils'

type Status = { connected: boolean; tenantSlug?: string } | null

export const StripeConnectStatus: React.FC = () => {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !checkRole(['tenant-admin'], user as unknown as Parameters<typeof checkRole>[1])) {
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

  if (loading || !user || !checkRole(['tenant-admin'], user as unknown as Parameters<typeof checkRole>[1])) {
    return null
  }
  if (status === null) {
    return null
  }
  if (status.connected) {
    return (
      <div data-testid="stripe-connect-status">
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
      <a href={href}>Connect Stripe</a>
    </div>
  )
}

export default StripeConnectStatus

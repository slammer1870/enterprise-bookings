'use client'

import * as React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

type Props = {
  label?: string
  target: 'account' | 'customer' | 'product' | 'subscription' | 'promotion-code'
}

const targetLabel: Record<Props['target'], string> = {
  account: 'account',
  customer: 'customer',
  product: 'product',
  subscription: 'subscription',
  'promotion-code': 'promotion code',
}

export const StripeDashboardLinkField: React.FC<Props> = ({ label, target }) => {
  const { id, collectionSlug } = useDocumentInfo()
  const [url, setUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const docId = typeof id === 'string' || typeof id === 'number' ? String(id) : ''
    if (!collectionSlug || !docId) {
      setUrl(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/admin/stripe/dashboard-link/${encodeURIComponent(collectionSlug)}/${encodeURIComponent(docId)}/${encodeURIComponent(target)}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        return (await res.json()) as { url?: string | null }
      })
      .then((data) => {
        if (!cancelled) setUrl(typeof data.url === 'string' && data.url.trim() ? data.url : null)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [collectionSlug, id, target])

  const effectiveLabel = label ?? `View ${targetLabel[target]} in Stripe`

  return (
    <div className="mb-4">
      <p className="label">{effectiveLabel}</p>
      {loading ? (
        <p style={{ color: 'var(--theme-elevation-400)' }}>Checking Stripe link...</p>
      ) : url ? (
        <a href={url} target="_blank" rel="noreferrer noopener">
          {effectiveLabel}
        </a>
      ) : (
        <p style={{ color: 'var(--theme-elevation-400)' }}>No Stripe {targetLabel[target]} linked yet.</p>
      )}
    </div>
  )
}

export default StripeDashboardLinkField

import type { UIFieldServerComponent } from 'payload'
import React from 'react'
import {
  getCustomHostnameStatus,
  type HostnameVerificationStatus,
} from '@/lib/cloudflare/customHostnames'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: HostnameVerificationStatus | null }) {
  if (!status) return null
  const map: Record<HostnameVerificationStatus, { icon: string; color: string; label: string }> = {
    active:  { icon: '✓', color: '#16a34a', label: 'Verified' },
    pending: { icon: '◷', color: '#ca8a04', label: 'Pending'  },
    error:   { icon: '✕', color: '#dc2626', label: 'Error'    },
    unknown: { icon: '?', color: '#6b7280', label: 'Unknown'  },
  }
  const { icon, color, label } = map[status]
  return (
    <span style={{ color, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
      {icon} {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Admin UI panel shown on the Tenants edit view when a custom domain is set.
 * Displays the single CNAME record the client needs to add, with live
 * verification status fetched from Cloudflare.
 *
 * The CNAME target is derived by convention as `cname.<platform-domain>` from
 * NEXT_PUBLIC_SERVER_URL. This must be a proxied (orange-cloud) A record in the
 * SaaS zone pointing directly to the origin server — NOT a per-tenant subdomain.
 * Using a per-tenant proxied subdomain causes Cloudflare Error 1000 (DNS loop).
 */
export const DomainDnsInstructions: UIFieldServerComponent = async ({ data }) => {
  const domain = typeof data?.domain === 'string' && data.domain.trim() ? data.domain.trim() : null

  if (!domain) return null

  const [cfStatus] = await Promise.all([
    getCustomHostnameStatus(domain),
  ])

  // Derive the CNAME target by convention: cname.<platform-domain>
  const cnameTarget = (() => {
    const url = process.env.NEXT_PUBLIC_SERVER_URL
    if (!url) return null
    try { return `cname.${new URL(url).hostname}` } catch { return null }
  })()

  const hostLabel = domain.split('.')[0] ?? '@'
  const isActive = cfStatus?.hostnameStatus === 'active' && cfStatus?.sslStatus === 'active'

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ marginBottom: 8 }}>Custom domain DNS setup</h4>

      {isActive ? (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ {domain} is active — SSL certificate issued and routing correctly.
        </p>
      ) : (
        <p style={{ marginBottom: 12, color: 'var(--theme-elevation-500)' }}>
          Ask the client to add this DNS record on their registrar for{' '}
          <strong>{domain}</strong>:
        </p>
      )}

      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {['Type', 'Host', 'Value', 'TTL', 'Status'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--theme-elevation-150)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '4px 8px' }}>CNAME</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{hostLabel}</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {cnameTarget ?? (
                <em style={{ color: 'var(--theme-error-500)' }}>Set NEXT_PUBLIC_SERVER_URL env var</em>
              )}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
            <td style={{ padding: '4px 8px' }}>
              <StatusBadge status={cfStatus?.hostnameStatus ?? null} />
            </td>
          </tr>
          {cfStatus && cfStatus.sslStatus !== 'active' && cfStatus.hostnameStatus === 'active' && (
            <tr>
              <td colSpan={5} style={{ padding: '4px 8px', fontSize: 12, color: '#ca8a04' }}>
                ◷ CNAME verified — SSL certificate is being issued, usually takes a few minutes.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!isActive && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          That&apos;s it — Cloudflare verifies ownership automatically via the CNAME.
          No TXT record is required.
        </p>
      )}
    </div>
  )
}

export default DomainDnsInstructions

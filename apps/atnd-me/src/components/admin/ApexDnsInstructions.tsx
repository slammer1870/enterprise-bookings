import type { UIFieldServerComponent } from 'payload'
import { resolve4 } from 'node:dns/promises'
import React from 'react'
import { stripFirstLabel } from '@/utilities/validateCustomDomain'
import {
  getCustomHostnameStatus,
  getDcvDelegationUuid,
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
 * Admin UI panel shown on the Tenants edit view when redirectApex is enabled.
 *
 * Shows all DNS records the client must add, with live verification status
 * fetched from Cloudflare, and uses DCV Delegation for the _acme-challenge
 * record so it is set once and auto-renews forever (no one-time TXT values).
 */
export const ApexDnsInstructions: UIFieldServerComponent = async ({ data }) => {
  const domain = typeof data?.domain === 'string' ? data.domain : null
  const token = typeof data?.apexDomainVerificationToken === 'string'
    ? data.apexDomainVerificationToken
    : null

  if (!domain) return null

  const apex = stripFirstLabel(domain)
  if (!apex) return null

  // Fetch in parallel: live hostname status, DCV delegation UUID, apex IP
  const [cfStatus, dcvUuid, apexIp] = await Promise.all([
    getCustomHostnameStatus(apex),
    getDcvDelegationUuid(),
    (async () => {
      if (process.env.CLOUDFLARE_APEX_IP) return process.env.CLOUDFLARE_APEX_IP
      const url = process.env.NEXT_PUBLIC_SERVER_URL
      if (!url) return null
      try {
        const cnameTarget = `cname.${new URL(url).hostname}`
        const [ip] = await resolve4(cnameTarget)
        return ip ?? null
      } catch {
        return null
      }
    })(),
  ])

  const dcvCnameTarget = dcvUuid ? `${apex}.${dcvUuid}.dcv.cloudflare.com` : null

  const isFullyActive = cfStatus?.hostnameStatus === 'active' && cfStatus?.sslStatus === 'active'

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ marginBottom: 4 }}>Apex domain DNS setup</h4>

      {isFullyActive ? (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ {apex} is active — SSL certificate issued and routing correctly.
        </p>
      ) : (
        <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          The <strong>{domain}</strong> CNAME is already in place (see above).
          The apex (<strong>{apex}</strong>) cannot use a CNAME, so it needs three records below.
          Add all three at once — then Cloudflare will issue an SSL certificate and activate the redirect.
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
          {/* A record — routes traffic through Cloudflare */}
          <tr>
            <td style={{ padding: '4px 8px' }}>A</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>@</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {apexIp ?? <em style={{ color: 'var(--theme-error-500)' }}>Set CLOUDFLARE_APEX_IP</em>}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
            <td style={{ padding: '4px 8px' }}>
              <StatusBadge status={cfStatus?.hostnameStatus ?? null} />
            </td>
          </tr>

          {/* Ownership TXT — proves domain control to Cloudflare */}
          <tr>
            <td style={{ padding: '4px 8px' }}>TXT</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>_cf-custom-hostname</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {token ?? <em style={{ color: 'var(--theme-warning-500)' }}>Save first to generate</em>}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
            <td style={{ padding: '4px 8px' }}>
              <StatusBadge status={cfStatus ? (cfStatus.hostnameStatus === 'active' ? 'active' : 'pending') : null} />
            </td>
          </tr>

          {/* DCV delegation CNAME — set once, auto-renews SSL forever */}
          <tr>
            <td style={{ padding: '4px 8px' }}>CNAME</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>_acme-challenge</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {dcvCnameTarget ?? (
                <em style={{ color: 'var(--theme-elevation-500)' }}>
                  Requires CLOUDFLARE_API_TOKEN to generate
                </em>
              )}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
            <td style={{ padding: '4px 8px' }}>
              <StatusBadge status={cfStatus?.sslStatus ?? null} />
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        The <code>_acme-challenge</code> CNAME uses{' '}
        <strong>DCV Delegation</strong> — set it once and Cloudflare renews the SSL
        certificate automatically forever. No more one-time TXT values.
      </p>
    </div>
  )
}

export default ApexDnsInstructions

import type { UIFieldServerComponent } from 'payload'
import { resolve4 } from 'node:dns/promises'
import React from 'react'
import { stripFirstLabel } from '@/utilities/validateCustomDomain'
import type { HostnameVerificationStatus } from '@/lib/cloudflare/customHostnames'

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
 * The apex domain is handled entirely by the origin server (Traefik / Let's Encrypt) —
 * no Cloudflare TLS for SaaS registration is required. This works with any DNS
 * provider since the client only needs to add a plain A record to the server IP.
 *
 * Set ORIGIN_SERVER_IP to your Hetzner (or other host) server's public IPv4.
 * The status indicator resolves the apex domain at render time to check propagation.
 */
export const ApexDnsInstructions: UIFieldServerComponent = async ({ data }) => {
  const domain = typeof data?.domain === 'string' ? data.domain : null
  if (!domain) return null

  const apex = stripFirstLabel(domain)
  if (!apex) return null

  const originIp = process.env.ORIGIN_SERVER_IP ?? null

  // Check if the apex A record has propagated to the origin server IP
  const aRecordStatus: HostnameVerificationStatus = await (async () => {
    if (!originIp) return 'unknown'
    try {
      const ips = await resolve4(apex)
      return ips.includes(originIp) ? 'active' : 'pending'
    } catch {
      return 'pending'
    }
  })()

  const isActive = aRecordStatus === 'active'

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ marginBottom: 4 }}>Apex domain DNS setup</h4>

      {isActive ? (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ {apex} A record is pointing to the server. SSL will be issued automatically on first visit.
        </p>
      ) : (
        <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          The <strong>{domain}</strong> CNAME is already in place (see above).
          Add one A record for the apex (<strong>{apex}</strong>) — the server issues
          an SSL certificate automatically on first HTTPS request.
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
            <td style={{ padding: '4px 8px' }}>A</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>@</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {originIp ?? (
                <em style={{ color: 'var(--theme-error-500)' }}>Set ORIGIN_SERVER_IP env var</em>
              )}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
            <td style={{ padding: '4px 8px' }}>
              <StatusBadge status={aRecordStatus} />
            </td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        That&apos;s it — just one record. Works with any DNS provider.
        SSL is issued automatically by the server; no TXT records or Cloudflare tokens required.
      </p>
    </div>
  )
}

export default ApexDnsInstructions

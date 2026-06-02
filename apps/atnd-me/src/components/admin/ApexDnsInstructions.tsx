import type { UIFieldServerComponent } from 'payload'
import { resolve4 } from 'node:dns/promises'
import React from 'react'
import { stripFirstLabel } from '@/utilities/validateCustomDomain'
import { getCustomHostnameStatus, type HostnameVerificationStatus } from '@/lib/cloudflare/customHostnames'

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
 * The apex domain is handled by Cloudflare TLS for SaaS — the same mechanism
 * used for the www custom domain — so SSL is managed at the Cloudflare edge
 * independently of the hosting platform. Switching to serverless only requires
 * updating the Cloudflare fallback origin; tenant DNS never changes.
 *
 * Client DNS setup:
 *   A  @                            → Cloudflare anycast IP (same network as cname.<platform>)
 *   TXT _cf-custom-hostname.<apex>  → verification token (stored as apexDomainVerificationToken)
 *
 * Cloudflare uses anycast for this A record, so `cname.<platform>` may return
 * multiple valid IPs. We sort the set to keep the displayed "Value" stable
 * across reloads, and treat the apex as active if it matches *any* of them.
 */
export const ApexDnsInstructions: UIFieldServerComponent = async ({ data }) => {
  const domain = typeof data?.domain === 'string' ? data.domain : null
  if (!domain) return null

  const apex = stripFirstLabel(domain)
  if (!apex) return null

  const verificationToken =
    typeof data?.apexDomainVerificationToken === 'string' && data.apexDomainVerificationToken
      ? data.apexDomainVerificationToken
      : null

  // Derive the Cloudflare anycast IP from cname.<platform> — this is the IP clients
  // should set as their apex A record so traffic routes through Cloudflare.
  const rootHostname = (() => {
    const url = process.env.NEXT_PUBLIC_SERVER_URL
    if (!url) return null
    try { return new URL(url).hostname.toLowerCase() } catch { return null }
  })()
  const cnameTarget = rootHostname ? `cname.${rootHostname}` : null

  const [cloudflareIps, cfStatus] = await Promise.all([
    cnameTarget
      ? resolve4(cnameTarget).then((ips) => ips.filter(Boolean).sort()).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    getCustomHostnameStatus(apex),
  ])

  // Display a deterministic "primary" IP while still considering all possible
  // anycast IPs for the propagation/active check.
  const cloudflareIp = cloudflareIps[0] ?? null

  // A-record DNS propagation check: is the apex pointing to the Cloudflare IP?
  const apexIps = await resolve4(apex).catch(() => [] as string[])
  const aRecordStatus: HostnameVerificationStatus =
    cloudflareIps.length > 0
      ? cloudflareIps.some((ip) => apexIps.includes(ip)) ? 'active' : 'pending'
      : 'unknown'

  const isFullyActive = aRecordStatus === 'active' && cfStatus?.sslStatus === 'active'

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ marginBottom: 4 }}>Apex domain setup</h4>

      {isFullyActive ? (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ {apex} is live — A record is pointing to Cloudflare and SSL is active.
        </p>
      ) : (
        <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          Add these two DNS records for <strong>{apex}</strong>. Cloudflare issues the SSL
          certificate automatically once both records propagate.
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
          {/* A record — routes apex through Cloudflare */}
          <tr>
            <td style={{ padding: '4px 8px' }}>A</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>@</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {cloudflareIp ?? (
                <em style={{ color: 'var(--theme-error-500)' }}>
                  Could not resolve — check NEXT_PUBLIC_SERVER_URL
                </em>
              )}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
            <td style={{ padding: '4px 8px' }}>
              <StatusBadge status={aRecordStatus} />
            </td>
          </tr>

          {/* TXT record — Cloudflare DCV to prove apex ownership for cert issuance */}
          <tr>
            <td style={{ padding: '4px 8px' }}>TXT</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
              _cf-custom-hostname.{apex}
            </td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
              {verificationToken ?? (
                <em style={{ color: 'var(--theme-error-500)' }}>
                  Token not yet generated — save this tenant to generate
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
        The A record routes apex traffic through Cloudflare (same network as <code>{cnameTarget ?? 'cname.<platform>'}</code>).
        The TXT record lets Cloudflare verify domain ownership and issue the SSL certificate.
        Once both records are in place, SSL is active within a few minutes.
      </p>

      {cfStatus && cfStatus.sslStatus !== 'active' && cfStatus.rawSslStatus && (
        <p style={{ marginTop: 4, fontSize: 11, color: 'var(--theme-elevation-500)' }}>
          Cloudflare SSL status: <code>{cfStatus.rawSslStatus}</code>
          {cfStatus.rawHostnameStatus !== cfStatus.rawSslStatus && (
            <> · Hostname: <code>{cfStatus.rawHostnameStatus}</code></>
          )}
        </p>
      )}
    </div>
  )
}

export default ApexDnsInstructions

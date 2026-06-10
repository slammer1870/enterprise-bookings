import type { UIFieldServerComponent } from 'payload'
import { resolve4 } from 'node:dns/promises'
import React from 'react'
import { stripFirstLabel } from '@/utilities/validateCustomDomain'
import { isApexPointingToCloudflare, lookupLiveTxtRecords } from '@/lib/cloudflare/apexDnsLookup'
import {
  getCustomHostnameStatus,
  isCloudflareConfigured,
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
 * Client DNS setup:
 *   A   @                            → Cloudflare anycast IP (after TXT validation)
 *   TXT _cf-custom-hostname.<apex>   → hostname ownership token
 *   TXT _acme-challenge.<apex>       → SSL DCV token(s) from Cloudflare
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

  const rootHostname = (() => {
    const url = process.env.NEXT_PUBLIC_SERVER_URL
    if (!url) return null
    try { return new URL(url).hostname.toLowerCase() } catch { return null }
  })()
  const cnameTarget = rootHostname ? `cname.${rootHostname}` : null

  const cfConfigured = isCloudflareConfigured()
  const acmeHost = `_acme-challenge.${apex}`
  const ownershipHost = `_cf-custom-hostname.${apex}`

  const [cloudflareIps, cfStatus, liveAcmeRecords, liveOwnershipRecords] = await Promise.all([
    cnameTarget
      ? resolve4(cnameTarget).then((ips) => ips.filter(Boolean).sort()).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    getCustomHostnameStatus(apex),
    lookupLiveTxtRecords(acmeHost, false),
    lookupLiveTxtRecords(ownershipHost, false),
  ])

  const apexIps = await resolve4(apex).catch(() => [] as string[])
  const aRecordActive = isApexPointingToCloudflare(apexIps, cloudflareIps)
  const aRecordStatus: HostnameVerificationStatus =
    apexIps.length === 0 ? 'pending' : aRecordActive ? 'active' : 'pending'

  const sslActive = cfStatus?.sslStatus === 'active'

  // Cloudflare omits validation_records once the cert is active — always supplement from live DNS.
  let acmeRecords = cfStatus?.sslValidationRecords ?? []
  if (acmeRecords.length === 0 && liveAcmeRecords.length > 0) {
    acmeRecords = liveAcmeRecords.map((r) => ({
      status: sslActive ? ('active' as const) : r.status,
      txtName: r.host,
      txtValue: r.value,
    }))
  }

  const ownershipFromDns = liveOwnershipRecords[0]?.value ?? null
  const ownershipValue = verificationToken ?? cfStatus?.ownershipTxtValue ?? ownershipFromDns

  const isFullyActive =
    aRecordActive &&
    cfStatus?.hostnameStatus === 'active' &&
    cfStatus?.sslStatus === 'active'

  const cfIpConflict = cfStatus?.verificationErrors.some((e) =>
    e.toLowerCase().includes('using cloudflare'),
  )

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ marginBottom: 4 }}>Apex domain setup</h4>

      {!cfConfigured && (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#ca8a04', lineHeight: 1.5 }}>
          Cloudflare API not configured on this server (set <code>CLOUDFLARE_API_TOKEN</code> and{' '}
          <code>CLOUDFLARE_ZONE_ID</code>). Showing live DNS lookups below; save tenant to register
          the hostname once credentials are set.
        </p>
      )}

      {cfIpConflict && (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#ca8a04', lineHeight: 1.5 }}>
          <strong>{apex} already resolves to Cloudflare IPs.</strong> Add the TXT records below
          first (at the client&apos;s DNS provider, e.g. Blacknight). If an apex A record is already
          pointing at Cloudflare, remove it until hostname and SSL validation complete, then add
          the A record.
        </p>
      )}

      {isFullyActive ? (
        <p style={{ marginBottom: 12, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✓ {apex} is live — A record is pointing to Cloudflare and SSL is active.
        </p>
      ) : (
        <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          Ask the client to add these DNS records for <strong>{apex}</strong>. Add the TXT records
          first, then the A record once validation completes.
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
          {/* TXT — hostname ownership */}
          <tr>
            <td style={{ padding: '4px 8px' }}>TXT</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
              _cf-custom-hostname.{apex}
            </td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
              {ownershipValue ?? (
                <em style={{ color: 'var(--theme-error-500)' }}>
                  Token not yet generated — save this tenant to generate
                </em>
              )}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
            <td style={{ padding: '4px 8px' }}>
              <StatusBadge status={cfStatus?.hostnameStatus ?? null} />
            </td>
          </tr>

          {/* TXT — ACME SSL DCV */}
          {acmeRecords.length > 0 ? (
            acmeRecords.map((record, index) => (
              <tr key={`${record.txtName}-${index}`}>
                <td style={{ padding: '4px 8px' }}>TXT</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                  {record.txtName}
                </td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>
                  {record.txtValue}
                </td>
                <td style={{ padding: '4px 8px' }}>Auto</td>
                <td style={{ padding: '4px 8px' }}>
                  <StatusBadge status={record.status} />
                </td>
              </tr>
            ))
          ) : sslActive ? (
            <tr>
              <td style={{ padding: '4px 8px' }}>TXT</td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                {acmeHost}
              </td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                <em style={{ color: '#16a34a' }}>Certificate issued — ACME TXT no longer required</em>
              </td>
              <td style={{ padding: '4px 8px' }}>Auto</td>
              <td style={{ padding: '4px 8px' }}>
                <StatusBadge status="active" />
              </td>
            </tr>
          ) : (
            <tr>
              <td style={{ padding: '4px 8px' }}>TXT</td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                {acmeHost}
              </td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace', fontSize: 11 }}>
                <em style={{ color: 'var(--theme-elevation-500)' }}>
                  {cfConfigured
                    ? 'Not in DNS yet — Cloudflare will provide the token after tenant save'
                    : 'Not in DNS yet — configure Cloudflare API env vars and save tenant'}
                </em>
              </td>
              <td style={{ padding: '4px 8px' }}>Auto</td>
              <td style={{ padding: '4px 8px' }}>
                <StatusBadge status={cfStatus?.sslStatus ?? null} />
              </td>
            </tr>
          )}

          {/* A — routes apex traffic after validation */}
          {cloudflareIps.length > 0 ? (
            cloudflareIps.map((ip) => (
              <tr key={ip}>
                <td style={{ padding: '4px 8px' }}>A</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>@</td>
                <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{ip}</td>
                <td style={{ padding: '4px 8px' }}>Auto</td>
                <td style={{ padding: '4px 8px' }}>
                  <StatusBadge status={aRecordStatus} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td style={{ padding: '4px 8px' }}>A</td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>@</td>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
                <em style={{ color: 'var(--theme-error-500)' }}>
                  Could not resolve — check NEXT_PUBLIC_SERVER_URL
                </em>
              </td>
              <td style={{ padding: '4px 8px' }}>Auto</td>
              <td style={{ padding: '4px 8px' }}>
                <StatusBadge status={aRecordStatus} />
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!isFullyActive && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
          The <code>_cf-custom-hostname</code> TXT record proves hostname ownership; the{' '}
          <code>_acme-challenge</code> TXT record(s) validate the SSL certificate. Add the A record
          last to route traffic through Cloudflare (same network as{' '}
          <code>{cnameTarget ?? 'cname.<platform>'}</code>).
        </p>
      )}

      {cfStatus && cfStatus.verificationErrors.length > 0 && (
        <p style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>
          Cloudflare: {cfStatus.verificationErrors.join(' ')}
        </p>
      )}

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

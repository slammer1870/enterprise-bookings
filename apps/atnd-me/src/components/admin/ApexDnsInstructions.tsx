import type { UIFieldServerComponent } from 'payload'
import React from 'react'
import { stripFirstLabel } from '@/utilities/validateCustomDomain'

/**
 * Admin UI panel shown on the Tenants edit view when redirectApex is enabled.
 * Displays the two DNS records the client must add to their registrar to activate
 * apex → www redirect via Cloudflare TLS for SaaS.
 */
export const ApexDnsInstructions: UIFieldServerComponent = ({ data }) => {
  const domain = typeof data?.domain === 'string' ? data.domain : null
  const token = typeof data?.apexDomainVerificationToken === 'string'
    ? data.apexDomainVerificationToken
    : null
  const apexIp = process.env.CLOUDFLARE_APEX_IP ?? null

  if (!domain) return null

  const apex = stripFirstLabel(domain)
  if (!apex) return null

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ marginBottom: 4 }}>Apex domain DNS setup</h4>
      <p style={{ marginBottom: 12, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        The <strong>{domain}</strong> CNAME is already in place (see above).
        The apex (<strong>{apex}</strong>) cannot use a CNAME, so it needs two extra records —
        an A record to route traffic and a TXT record for Cloudflare to issue its SSL certificate.
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {['Type', 'Host', 'Value', 'TTL'].map((h) => (
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
              {apexIp ?? <em style={{ color: 'var(--theme-error-500)' }}>Set CLOUDFLARE_APEX_IP env var</em>}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 8px' }}>TXT</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>_cf-custom-hostname</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {token
                ? token
                : <em style={{ color: 'var(--theme-warning-500)' }}>Pending — save first to generate</em>}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        Once both records propagate, Cloudflare will issue an SSL certificate for{' '}
        <strong>{apex}</strong> and redirect it to <strong>{domain}</strong>.
      </p>
    </div>
  )
}

export default ApexDnsInstructions

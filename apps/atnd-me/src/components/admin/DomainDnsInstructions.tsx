import type { UIFieldServerComponent } from 'payload'
import React from 'react'

/**
 * Admin UI panel shown on the Tenants edit view when a custom domain is set.
 * Displays the single CNAME record the client needs to add to their registrar.
 *
 * Cloudflare TLS for SaaS verifies ownership automatically via the CNAME chain
 * (CNAME DCV), so no additional TXT record is required for subdomain custom domains.
 */
export const DomainDnsInstructions: UIFieldServerComponent = ({ data }) => {
  const domain = typeof data?.domain === 'string' && data.domain.trim() ? data.domain.trim() : null
  const slug = typeof data?.slug === 'string' && data.slug.trim() ? data.slug.trim() : null

  if (!domain || !slug) return null

  const rootHostname = (() => {
    const url = process.env.NEXT_PUBLIC_SERVER_URL
    if (!url) return null
    try { return new URL(url).hostname } catch { return null }
  })()

  const cnameTarget = rootHostname ? `${slug}.${rootHostname}` : null

  // Derive the host label to CNAME (first label of the domain)
  const hostLabel = domain.split('.')[0] ?? '@'

  return (
    <div style={{ padding: '12px 0' }}>
      <h4 style={{ marginBottom: 8 }}>Custom domain DNS setup</h4>
      <p style={{ marginBottom: 12, color: 'var(--theme-elevation-500)' }}>
        Ask the client to add this DNS record on their registrar for{' '}
        <strong>{domain}</strong>:
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
            <td style={{ padding: '4px 8px' }}>CNAME</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{hostLabel}</td>
            <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
              {cnameTarget ?? (
                <em style={{ color: 'var(--theme-error-500)' }}>Set NEXT_PUBLIC_SERVER_URL env var</em>
              )}
            </td>
            <td style={{ padding: '4px 8px' }}>Auto</td>
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--theme-elevation-500)' }}>
        That&apos;s it — Cloudflare verifies ownership automatically via the CNAME.
        No TXT record is required for subdomain custom domains.
      </p>
    </div>
  )
}

export default DomainDnsInstructions

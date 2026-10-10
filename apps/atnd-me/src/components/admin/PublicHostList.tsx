import type { UIFieldServerComponent } from 'payload'
import React from 'react'
import { getPlatformRootHostname } from '@/utilities/validateCustomDomain'
import {
  getClaimedApex,
  getTenantPlatformSubdomain,
  mergeTenantPublicHostDeclaration,
} from '@/utilities/tenantPublicHostDeclaration'

const cellStyle = { padding: '4px 8px', fontFamily: 'monospace' } as const
const headerStyle = {
  textAlign: 'left' as const,
  padding: '4px 8px',
  borderBottom: '1px solid var(--theme-elevation-150)',
}

function saasTarget(): string | null {
  const root = getPlatformRootHostname()
  return root ? `cname.${root}` : null
}

/** `@` on an apex; the labels in front of the claimed apex otherwise. */
function dnsHost(hostname: string): string {
  const apex = getClaimedApex(hostname)
  if (hostname === apex) return '@'
  const suffix = `.${apex}`
  if (hostname.endsWith(suffix)) return hostname.slice(0, -suffix.length)
  return hostname
}

type PublicHostRow = {
  hostname: string
  role: 'canonical' | 'alias'
  routingRecord: { host: string; value: string } | null
}

function publicHostRows(data: Record<string, unknown> | undefined): PublicHostRow[] {
  const declaration = mergeTenantPublicHostDeclaration(data ?? {})
  const target = saasTarget()
  const rows: PublicHostRow[] = []

  if (declaration.canonicalHost) {
    const customHosts = [declaration.canonicalHost, ...declaration.aliasHosts]
    for (const [index, hostname] of customHosts.entries()) {
      rows.push({
        hostname,
        role: index === 0 ? 'canonical' : 'alias',
        routingRecord: {
          host: dnsHost(hostname),
          value: target ?? 'SaaS target is not configured',
        },
      })
    }
  }

  const platformHost = getTenantPlatformSubdomain(declaration.slug)
  if (platformHost) {
    rows.push({
      hostname: platformHost,
      role: declaration.canonicalHost ? 'alias' : 'canonical',
      routingRecord: null,
    })
  }

  return rows
}

/**
 * One list of the tenant's public hosts. Custom domains show a CNAME to the
 * SaaS target. The platform subdomain shows its role only.
 */
export const PublicHostList: UIFieldServerComponent = async ({ data }) => {
  const rows = publicHostRows(data as Record<string, unknown> | undefined)
  if (rows.length === 0) return null

  return (
    <div style={{ padding: '12px 0' }}>
      <table aria-label="Public hosts" style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {['Public host', 'Role', 'Type', 'DNS host', 'Value'].map((heading) => (
              <th key={heading} style={headerStyle}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.hostname}>
              <td style={cellStyle}>{row.hostname}</td>
              <td style={{ ...cellStyle, fontFamily: 'inherit' }}>{row.role}</td>
              <td style={{ ...cellStyle, fontFamily: 'inherit' }}>{row.routingRecord ? 'CNAME' : ''}</td>
              <td style={cellStyle}>{row.routingRecord?.host ?? ''}</td>
              <td style={cellStyle}>{row.routingRecord?.value ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PublicHostList

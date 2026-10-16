import type { UIFieldServerComponent } from 'payload'
import React from 'react'
import type { Tenant } from '@/payload-types'
import { getCustomHostnameStatus } from '@/lib/cloudflare/customHostnames'
import { getPlatformRootHostname } from '@/utilities/validateCustomDomain'
import {
  getClaimedApex,
  getTenantPlatformSubdomain,
  mergeTenantPublicHostDeclaration,
  type TenantPublicHostDocSlice,
} from '@/utilities/tenantPublicHostDeclaration'
import { apexProxyingRecords } from './apexProxying'
import { acmeTxtsToShow, ownershipTxtToShow } from './publicHostTxt'
import { certificateStatusLabel, dnsStatusLabel, type StatusLabel } from './publicHostStatus'

const cellStyle = { padding: '4px 8px', fontFamily: 'monospace' } as const
const textCellStyle = { ...cellStyle, fontFamily: 'inherit' } as const
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

type HostRole = 'canonical' | 'alias'

type RoutingRow = {
  kind: 'routing'
  key: string
  hostname: string
  role: HostRole
  dnsHost: string
  value: string
  dnsStatus: StatusLabel
  certificateStatus: StatusLabel
  verificationErrors: string[]
}

type RecordRow = {
  kind: 'record'
  key: string
  type: 'A' | 'AAAA' | 'TXT'
  dnsHost: string
  value: string
}

type PlatformRow = {
  kind: 'platform'
  key: string
  hostname: string
  role: HostRole
}

type PublicHostRow = RoutingRow | RecordRow | PlatformRow

function recordRow(key: string, type: RecordRow['type'], host: string, value: string): RecordRow {
  return { kind: 'record', key, type, dnsHost: host, value }
}

function hostDeclaration(data: unknown): TenantPublicHostDocSlice {
  if (data == null || typeof data !== 'object') return {}
  const doc = data as Pick<Tenant, 'domain' | 'aliasHosts' | 'slug'>
  return { domain: doc.domain, aliasHosts: doc.aliasHosts, slug: doc.slug }
}

async function publicHostRows(data: unknown): Promise<PublicHostRow[]> {
  const declaration = mergeTenantPublicHostDeclaration(hostDeclaration(data))
  const target = saasTarget()
  const rows: PublicHostRow[] = []

  if (declaration.canonicalHost) {
    const customHosts = [declaration.canonicalHost, ...declaration.aliasHosts]
    const statuses = await Promise.all(customHosts.map((hostname) => getCustomHostnameStatus(hostname)))
    for (const [index, hostname] of customHosts.entries()) {
      const status = statuses[index] ?? null
      rows.push({
        kind: 'routing',
        key: hostname,
        hostname,
        role: index === 0 ? 'canonical' : 'alias',
        dnsHost: dnsHost(hostname),
        value: target ?? '',
        dnsStatus: dnsStatusLabel(status?.rawHostnameStatus),
        certificateStatus: certificateStatusLabel(status?.rawSslStatus),
        verificationErrors: status?.verificationErrors ?? [],
      })
      const ownership = ownershipTxtToShow(status)
      if (ownership) {
        rows.push(recordRow(`TXT:${hostname}:${ownership.name}`, 'TXT', ownership.name, ownership.value))
      }
      for (const txt of acmeTxtsToShow(status)) {
        rows.push(recordRow(`TXT:${hostname}:${txt.name}:${txt.value}`, 'TXT', txt.name, txt.value))
      }
      if (dnsHost(hostname) === '@') {
        for (const record of apexProxyingRecords()) {
          rows.push(recordRow(`${hostname}:${record.type}:${record.value}`, record.type, '@', record.value))
        }
      }
    }
  }

  const platformHost = getTenantPlatformSubdomain(declaration.slug)
  if (platformHost) {
    rows.push({
      kind: 'platform',
      key: platformHost,
      hostname: platformHost,
      role: declaration.canonicalHost ? 'alias' : 'canonical',
    })
  }

  return rows
}

const COLUMNS = [
  { key: 'host', heading: 'Public host', monospace: true },
  { key: 'role', heading: 'Role', monospace: false },
  { key: 'type', heading: 'Type', monospace: false },
  { key: 'dnsHost', heading: 'DNS host', monospace: true },
  { key: 'value', heading: 'Value', monospace: true },
  { key: 'dnsStatus', heading: 'DNS status', monospace: false },
  { key: 'certificateStatus', heading: 'Certificate status', monospace: false },
] as const

type ColumnKey = (typeof COLUMNS)[number]['key']

const EMPTY_CELLS: Record<ColumnKey, React.ReactNode> = {
  host: '',
  role: '',
  type: '',
  dnsHost: '',
  value: '',
  dnsStatus: '',
  certificateStatus: '',
}

function rowCells(row: PublicHostRow): Record<ColumnKey, React.ReactNode> {
  if (row.kind === 'routing') {
    return {
      ...EMPTY_CELLS,
      host: row.hostname,
      role: row.role,
      type: 'CNAME',
      dnsHost: row.dnsHost,
      value: row.value,
      dnsStatus: (
        <>
          {row.dnsStatus}
          {row.verificationErrors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </>
      ),
      certificateStatus: row.certificateStatus,
    }
  }
  if (row.kind === 'record') {
    return { ...EMPTY_CELLS, type: row.type, dnsHost: row.dnsHost, value: row.value }
  }
  return { ...EMPTY_CELLS, host: row.hostname, role: row.role }
}

function HostRow({ row }: { row: PublicHostRow }) {
  const cells = rowCells(row)
  return (
    <tr>
      {COLUMNS.map((column) => (
        <td key={column.key} style={column.monospace ? cellStyle : textCellStyle}>
          {cells[column.key]}
        </td>
      ))}
    </tr>
  )
}

/**
 * One list of the tenant's public hosts. Custom domains show a CNAME to the
 * SaaS target, with DNS and certificate status on that row. An apex also shows
 * Apex Proxying A and AAAA rows when those addresses are known, without a
 * second status pair. The platform subdomain shows its role only.
 */
export const PublicHostList: UIFieldServerComponent = async ({ data }) => {
  const rows = await publicHostRows(data)
  if (rows.length === 0) return null

  return (
    <div style={{ padding: '12px 0' }}>
      <table aria-label="Public hosts" style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} style={headerStyle}>
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <HostRow key={row.key} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PublicHostList

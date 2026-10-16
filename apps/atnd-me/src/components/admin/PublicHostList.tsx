import type { UIFieldServerComponent } from 'payload'
import React from 'react'
import type { Tenant } from '@/payload-types'
import { getCustomHostnameStatus } from '@/lib/cloudflare/customHostnames'
import { getPlatformRootHostname } from '@/utilities/validateCustomDomain'
import {
  getClaimedApex,
  getTenantPlatformSubdomain,
  mergeTenantPublicHostDeclaration,
  readHostnameDeclaration,
  type DerivedPublicHostRoles,
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

type HostRole = string

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
  const doc = data as Pick<Tenant, 'domain' | 'aliasHosts' | 'hostnames' | 'direction' | 'slug'>
  return {
    domain: doc.domain,
    aliasHosts: doc.aliasHosts,
    hostnames: doc.hostnames,
    direction: doc.direction,
    slug: doc.slug,
  }
}

/** Canonical wins over serving. An alias names the host it redirects to. */
function hostnameRole(hostname: string, roles: DerivedPublicHostRoles): string {
  if (hostname === roles.canonicalHost) return 'canonical'
  const alias = roles.aliases.find((entry) => entry.host === hostname)
  if (alias) return `alias to ${alias.target}`
  return 'serving'
}

async function customHostRows(hosts: Array<{ hostname: string; role: string }>): Promise<PublicHostRow[]> {
  const target = saasTarget()
  const statuses = await Promise.all(hosts.map((host) => getCustomHostnameStatus(host.hostname)))
  const rows: PublicHostRow[] = []
  for (const [index, host] of hosts.entries()) {
    const status = statuses[index] ?? null
    rows.push({
      kind: 'routing',
      key: host.hostname,
      hostname: host.hostname,
      role: host.role,
      dnsHost: dnsHost(host.hostname),
      value: target ?? '',
      dnsStatus: dnsStatusLabel(status?.rawHostnameStatus),
      certificateStatus: certificateStatusLabel(status?.rawSslStatus),
      verificationErrors: status?.verificationErrors ?? [],
    })
    const ownership = ownershipTxtToShow(status)
    if (ownership) {
      rows.push(recordRow(`TXT:${host.hostname}:${ownership.name}`, 'TXT', ownership.name, ownership.value))
    }
    for (const txt of acmeTxtsToShow(status)) {
      rows.push(recordRow(`TXT:${host.hostname}:${txt.name}:${txt.value}`, 'TXT', txt.name, txt.value))
    }
    if (dnsHost(host.hostname) === '@') {
      for (const record of apexProxyingRecords()) {
        rows.push(recordRow(`${host.hostname}:${record.type}:${record.value}`, record.type, '@', record.value))
      }
    }
  }
  return rows
}

function platformRow(hostname: string, role: string): PlatformRow {
  return { kind: 'platform', key: hostname, hostname, role }
}

async function publicHostRows(data: unknown): Promise<PublicHostRow[]> {
  const doc = hostDeclaration(data)
  const stored = readHostnameDeclaration(doc)
  const rows: PublicHostRow[] = []

  if (stored.hostnames !== null && stored.roles) {
    const roles = stored.roles
    const hostnames = stored.hostnames
    rows.push(
      ...(await customHostRows(hostnames.map((hostname) => ({ hostname, role: hostnameRole(hostname, roles) })))),
    )
    const platformHost = getTenantPlatformSubdomain(typeof doc.slug === 'string' ? doc.slug : '')
    if (platformHost) {
      const role = hostnames.length === 0 ? 'canonical' : `alias to ${roles.canonicalHost}`
      rows.push(platformRow(platformHost, role))
    }
    return rows
  }

  const declaration = mergeTenantPublicHostDeclaration(doc)
  if (declaration.canonicalHost) {
    const customHosts = [declaration.canonicalHost, ...declaration.aliasHosts]
    rows.push(
      ...(await customHostRows(
        customHosts.map((hostname, index) => ({
          hostname,
          role: index === 0 ? 'canonical' : 'alias',
        })),
      )),
    )
  }

  const platformHost = getTenantPlatformSubdomain(declaration.slug)
  if (platformHost) {
    rows.push(platformRow(platformHost, declaration.canonicalHost ? 'alias' : 'canonical'))
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
 * One list of the tenant's public hosts. A stored hostname list is shown in
 * typed order, then the platform subdomain. Each typed hostname shows its role,
 * a CNAME to the SaaS target, and DNS and certificate status. An apex also shows
 * Apex Proxying A and AAAA rows when those addresses are known. The platform
 * subdomain shows its role only.
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

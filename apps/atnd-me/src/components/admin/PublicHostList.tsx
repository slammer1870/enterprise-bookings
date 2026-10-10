import { isIP } from 'node:net'
import type { UIFieldServerComponent } from 'payload'
import React from 'react'
import { getCustomHostnameStatus, type CustomHostnameStatusResult } from '@/lib/cloudflare/customHostnames'
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

type StatusLabel = 'Active' | 'Pending' | 'Error' | 'Unknown'

const DNS_ERROR = new Set(['blocked', 'moved', 'deleted'])

/** DNS Active is `active` or `active_redeploying`. Pending is `pending`. Error is `blocked`, `moved`, or `deleted`. */
function dnsStatusLabel(raw: string | null | undefined): StatusLabel {
  if (raw === 'active' || raw === 'active_redeploying') return 'Active'
  if (raw === 'pending') return 'Pending'
  if (raw != null && DNS_ERROR.has(raw)) return 'Error'
  return 'Unknown'
}

const CERTIFICATE_PENDING = new Set([
  'pending',
  'initializing',
  'pending_validation',
  'pending_issuance',
  'pending_deployment',
  'staging_active',
  'backup_issued',
])

/** Certificate Active is Cloudflare SSL `active` only. Issuance, including `staging_active` and `backup_issued`, stays Pending. */
function certificateStatusLabel(raw: string | null | undefined): StatusLabel {
  if (raw === 'active') return 'Active'
  if (raw != null && CERTIFICATE_PENDING.has(raw)) return 'Pending'
  return 'Unknown'
}

type PublicHostRow = {
  key: string
  hostname: string
  role: 'canonical' | 'alias' | ''
  type: 'CNAME' | 'A' | 'AAAA' | 'TXT' | ''
  dnsHost: string
  value: string
  dnsStatus: StatusLabel | null
  certificateStatus: StatusLabel | null
  verificationErrors: string[]
}

/** Allocated Apex Proxying addresses. Unknown, or not an address of this family, is omitted. */
function allocatedAddresses(envName: 'CLOUDFLARE_APEX_PROXYING_A' | 'CLOUDFLARE_APEX_PROXYING_AAAA', family: 4 | 6): string[] {
  const raw = process.env[envName]
  if (!raw) return []
  const seen = new Set<string>()
  const addresses: string[] = []
  for (const part of raw.split(/[\s,]+/)) {
    const value = part.trim()
    if (isIP(value) !== family || seen.has(value)) continue
    seen.add(value)
    addresses.push(value)
  }
  return addresses
}

const APEX_PROXYING_RECORDS = [
  { type: 'A', envName: 'CLOUDFLARE_APEX_PROXYING_A', family: 4 },
  { type: 'AAAA', envName: 'CLOUDFLARE_APEX_PROXYING_AAAA', family: 6 },
] as const

function apexProxyingRows(hostname: string): PublicHostRow[] {
  if (dnsHost(hostname) !== '@') return []
  const rows: PublicHostRow[] = []
  for (const record of APEX_PROXYING_RECORDS) {
    for (const value of allocatedAddresses(record.envName, record.family)) {
      rows.push({
        key: `${hostname}:${record.type}:${value}`,
        hostname: '',
        role: '',
        type: record.type,
        dnsHost: '@',
        value,
        dnsStatus: null,
        certificateStatus: null,
        verificationErrors: [],
      })
    }
  }
  return rows
}

/** A zone already on Cloudflare cannot use ownership or `_acme-challenge` TXT. */
function zoneAlreadyOnCloudflare(status: CustomHostnameStatusResult): boolean {
  return status.verificationErrors.some((error) => /using cloudflare/i.test(error))
}

/** Ownership TXT while DNS status is not Active and Cloudflare has issued a name and value. */
function ownershipTxtRows(hostname: string, status: CustomHostnameStatusResult | null): PublicHostRow[] {
  if (!status || dnsStatusLabel(status.rawHostnameStatus) === 'Active' || zoneAlreadyOnCloudflare(status)) return []
  const name = status.ownershipTxtName?.trim() ?? ''
  const value = status.ownershipTxtValue?.trim() ?? ''
  if (!name || !value) return []
  return [
    {
      key: `TXT:${hostname}:${name}`,
      hostname: '',
      role: '',
      type: 'TXT',
      dnsHost: name,
      value,
      dnsStatus: null,
      certificateStatus: null,
      verificationErrors: [],
    },
  ]
}

/** Each `_acme-challenge` TXT while certificate status is not Active. Delegated DCV stays off the list. */
function acmeTxtRows(hostname: string, status: CustomHostnameStatusResult | null): PublicHostRow[] {
  if (!status || certificateStatusLabel(status.rawSslStatus) === 'Active' || zoneAlreadyOnCloudflare(status)) return []
  const rows: PublicHostRow[] = []
  for (const record of status.sslValidationRecords) {
    const name = record.txtName.trim()
    const value = record.txtValue.trim()
    if (!name.includes('_acme-challenge') || value.includes('dcv.cloudflare.com') || name === '' || value === '') {
      continue
    }
    rows.push({
      key: `TXT:${hostname}:${name}:${value}`,
      hostname: '',
      role: '',
      type: 'TXT',
      dnsHost: name,
      value,
      dnsStatus: null,
      certificateStatus: null,
      verificationErrors: [],
    })
  }
  return rows
}

async function publicHostRows(data: Record<string, unknown> | undefined): Promise<PublicHostRow[]> {
  const declaration = mergeTenantPublicHostDeclaration(data ?? {})
  const target = saasTarget()
  const rows: PublicHostRow[] = []

  if (declaration.canonicalHost) {
    const customHosts = [declaration.canonicalHost, ...declaration.aliasHosts]
    const statuses = await Promise.all(customHosts.map((hostname) => getCustomHostnameStatus(hostname)))
    for (const [index, hostname] of customHosts.entries()) {
      const status = statuses[index]
      rows.push({
        key: hostname,
        hostname,
        role: index === 0 ? 'canonical' : 'alias',
        type: 'CNAME',
        dnsHost: dnsHost(hostname),
        value: target ?? '',
        dnsStatus: dnsStatusLabel(status?.rawHostnameStatus),
        certificateStatus: certificateStatusLabel(status?.rawSslStatus),
        verificationErrors: status?.verificationErrors ?? [],
      })
      rows.push(...ownershipTxtRows(hostname, status ?? null))
      rows.push(...acmeTxtRows(hostname, status ?? null))
      rows.push(...apexProxyingRows(hostname))
    }
  }

  const platformHost = getTenantPlatformSubdomain(declaration.slug)
  if (platformHost) {
    rows.push({
      key: platformHost,
      hostname: platformHost,
      role: declaration.canonicalHost ? 'alias' : 'canonical',
      type: '',
      dnsHost: '',
      value: '',
      dnsStatus: null,
      certificateStatus: null,
      verificationErrors: [],
    })
  }

  return rows
}

/**
 * One list of the tenant's public hosts. Custom domains show a CNAME to the
 * SaaS target, with DNS and certificate status on that row. An apex also shows
 * Apex Proxying A and AAAA rows when those addresses are known, without a
 * second status pair. The platform subdomain shows its role only.
 */
export const PublicHostList: UIFieldServerComponent = async ({ data }) => {
  const rows = await publicHostRows(data as Record<string, unknown> | undefined)
  if (rows.length === 0) return null

  return (
    <div style={{ padding: '12px 0' }}>
      <table aria-label="Public hosts" style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            {['Public host', 'Role', 'Type', 'DNS host', 'Value', 'DNS status', 'Certificate status'].map((heading) => (
              <th key={heading} style={headerStyle}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td style={cellStyle}>{row.hostname}</td>
              <td style={{ ...cellStyle, fontFamily: 'inherit' }}>{row.role}</td>
              <td style={{ ...cellStyle, fontFamily: 'inherit' }}>{row.type}</td>
              <td style={cellStyle}>{row.dnsHost}</td>
              <td style={cellStyle}>{row.value}</td>
              <td style={{ ...cellStyle, fontFamily: 'inherit' }}>
                {row.dnsStatus ?? ''}
                {row.verificationErrors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'inherit' }}>{row.certificateStatus ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default PublicHostList

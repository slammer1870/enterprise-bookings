import { isIP } from 'node:net'

export type ApexProxyingRecord = {
  type: 'A' | 'AAAA'
  value: string
}

const APEX_PROXYING_FAMILIES = [
  { type: 'A', envName: 'CLOUDFLARE_APEX_PROXYING_A', family: 4 },
  { type: 'AAAA', envName: 'CLOUDFLARE_APEX_PROXYING_AAAA', family: 6 },
] as const

/** Allocated addresses for one family. Blank, duplicate, and non-address values are omitted. */
function allocatedAddresses(envName: (typeof APEX_PROXYING_FAMILIES)[number]['envName'], family: 4 | 6): string[] {
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

/** Apex Proxying A and AAAA records from the allocated addresses. An unknown family is omitted. */
export function apexProxyingRecords(): ApexProxyingRecord[] {
  const records: ApexProxyingRecord[] = []
  for (const family of APEX_PROXYING_FAMILIES) {
    for (const value of allocatedAddresses(family.envName, family.family)) {
      records.push({ type: family.type, value })
    }
  }
  return records
}

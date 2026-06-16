import { resolveTxt } from 'node:dns/promises'
import type { HostnameVerificationStatus } from './customHostnames'

export interface LiveTxtRecord {
  host: string
  value: string
  status: HostnameVerificationStatus
}

/**
 * Returns true when an IPv4 address belongs to Cloudflare's published anycast ranges.
 * @see https://www.cloudflare.com/ips-v4/
 */
export function isCloudflareEdgeIp(ip: string): boolean {
  const octets = ip.split('.').map(Number)
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false
  }
  const [a, b] = octets as [number, number, number, number]
  if (a === 104 && b >= 16 && b <= 31) return true
  if (a === 172 && b >= 64 && b <= 71) return true
  if (a === 173 && b === 245) return true
  if (a === 103 && b === 21) return true
  if (a === 141 && b === 101) return true
  if (a === 108 && b === 162) return true
  if (a === 190 && b === 93) return true
  if (a === 188 && b === 114) return true
  if (a === 197 && b === 234) return true
  if (a === 198 && b === 41) return true
  return false
}

/**
 * True when the apex has A records pointing at Cloudflare.
 *
 * We cannot compare apex IPs to cname.<platform> IPs — Cloudflare anycast returns
 * different edge IPs depending on resolver location, so a working redirect may not
 * share the exact same addresses as the platform cname target.
 */
export function isApexPointingToCloudflare(apexIps: string[], platformIps: string[]): boolean {
  if (apexIps.length === 0) return false
  if (platformIps.some((ip) => apexIps.includes(ip))) return true
  return apexIps.every(isCloudflareEdgeIp)
}

/** Reads TXT records from public DNS — works even when the Cloudflare API returns nothing. */
export async function lookupLiveTxtRecords(
  host: string,
  verified: boolean,
): Promise<LiveTxtRecord[]> {
  const values = await resolveTxt(host).catch(() => [] as string[][])
  const status: HostnameVerificationStatus = verified ? 'active' : values.length > 0 ? 'unknown' : 'pending'
  return values.flat().map((value) => ({ host, value, status }))
}

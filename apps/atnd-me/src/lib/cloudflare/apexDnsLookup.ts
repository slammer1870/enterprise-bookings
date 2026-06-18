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
 *
 * Ranges (as of 2026):
 *   103.21.244.0/22  103.22.200.0/22  103.31.4.0/22
 *   104.16.0.0/13    104.24.0.0/14
 *   131.0.72.0/22    141.101.64.0/18  162.158.0.0/15
 *   172.64.0.0/13    188.114.96.0/20  190.93.240.0/20
 *   197.234.240.0/22 198.41.128.0/17
 *   Legacy (still seen): 108.162.192.0/18  173.245.48.0/20
 */
export function isCloudflareEdgeIp(ip: string): boolean {
  const octets = ip.split('.').map(Number)
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false
  }
  const [a, b, c] = octets as [number, number, number, number]
  // 104.16.0.0/13
  if (a === 104 && b >= 16 && b <= 23) return true
  // 104.24.0.0/14
  if (a === 104 && b >= 24 && b <= 27) return true
  // 172.64.0.0/13
  if (a === 172 && b >= 64 && b <= 71) return true
  // 162.158.0.0/15 — common anycast range, was missing
  if (a === 162 && (b === 158 || b === 159)) return true
  // 103.21.244.0/22
  if (a === 103 && b === 21 && c >= 244 && c <= 247) return true
  // 103.22.200.0/22
  if (a === 103 && b === 22 && c >= 200 && c <= 203) return true
  // 103.31.4.0/22
  if (a === 103 && b === 31 && c >= 4 && c <= 7) return true
  // 131.0.72.0/22
  if (a === 131 && b === 0 && c >= 72 && c <= 75) return true
  // 141.101.64.0/18
  if (a === 141 && b === 101 && c >= 64 && c <= 127) return true
  // 188.114.96.0/20
  if (a === 188 && b === 114 && c >= 96 && c <= 111) return true
  // 190.93.240.0/20
  if (a === 190 && b === 93 && c >= 240) return true
  // 197.234.240.0/22
  if (a === 197 && b === 234 && c >= 240 && c <= 243) return true
  // 198.41.128.0/17
  if (a === 198 && b === 41 && c >= 128) return true
  // Legacy: 173.245.48.0/20 and 108.162.192.0/18 (still seen in practice)
  if (a === 173 && b === 245 && c >= 48 && c <= 63) return true
  if (a === 108 && b === 162 && c >= 192) return true
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

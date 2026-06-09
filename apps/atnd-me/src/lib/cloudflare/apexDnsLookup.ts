import { resolveTxt } from 'node:dns/promises'
import type { HostnameVerificationStatus } from './customHostnames'

export interface LiveTxtRecord {
  host: string
  value: string
  status: HostnameVerificationStatus
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

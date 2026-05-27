/**
 * Cloudflare TLS for SaaS — custom hostname management.
 * Used to provision SSL certificates for tenant custom domains.
 *
 * Required env vars (only two):
 *   CLOUDFLARE_API_TOKEN  — token with Zone:Custom Hostnames:Edit permission
 *   CLOUDFLARE_ZONE_ID    — zone ID of the platform Cloudflare zone
 *
 * One-time Cloudflare setup (no further env vars needed):
 *   1. DNS tab: add `cname.<platform-domain>` A record → origin server IP, Proxied (orange cloud)
 *   2. SSL/TLS → Custom Hostnames → Fallback Origin: set to `cname.<platform-domain>`
 *
 * Everything else (CNAME target for admin UI, apex A record IP) is derived automatically
 * from NEXT_PUBLIC_SERVER_URL at runtime.
 */

const CF_API = 'https://api.cloudflare.com/client/v4'

export interface CustomHostnameResult {
  id: string
  verificationTxtValue: string
  status: string
}

interface CfCustomHostname {
  id: string
  hostname: string
  status: string
  ownership_verification?: {
    type: string
    name: string
    value: string
  }
  ssl?: {
    status: string
  }
}

export type HostnameVerificationStatus = 'active' | 'pending' | 'error' | 'unknown'

export interface CustomHostnameStatusResult {
  /** Overall hostname routing status — 'active' means traffic is flowing */
  hostnameStatus: HostnameVerificationStatus
  /** SSL cert status — 'active' means the cert is issued and deployed */
  sslStatus: HostnameVerificationStatus
  /** Raw Cloudflare status string for the hostname */
  rawHostnameStatus: string
  /** Raw Cloudflare SSL status string */
  rawSslStatus: string
  /** The ownership TXT value (_cf-custom-hostname) if available */
  ownershipTxtValue: string | null
}

interface CfApiResponse<T> {
  result: T
  success: boolean
  errors: Array<{ code: number; message: string }>
}

function getConfig(): { token: string; zoneId: string } {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set')

  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim()
  if (!zoneId) throw new Error('CLOUDFLARE_ZONE_ID is not set')

  return { token, zoneId }
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

function extractResult(record: CfCustomHostname): CustomHostnameResult {
  return {
    id: record.id,
    verificationTxtValue: record.ownership_verification?.value ?? '',
    status: record.status,
  }
}

/**
 * Creates a Cloudflare TLS for SaaS custom hostname for the given domain,
 * or returns the existing one if it is already registered (idempotent).
 *
 * For subdomains (e.g. www.example.com) we use HTTP validation — Cloudflare
 * verifies ownership automatically once the CNAME is pointing to the zone,
 * so the client needs no extra DNS records beyond the CNAME itself.
 *
 * For apex domains (e.g. example.com) we use TXT validation — apex domains
 * cannot use CNAME so HTTP validation is unavailable. The returned
 * `verificationTxtValue` must be set as a TXT record at
 * `_cf-custom-hostname.{hostname}`.
 *
 * @param isApex - true for bare apex domains, false (default) for subdomains
 */
export async function createOrGetCustomHostname(
  hostname: string,
  isApex = false,
): Promise<CustomHostnameResult> {
  const { token, zoneId } = getConfig()

  const sslMethod = isApex ? 'txt' : 'http'

  const createRes = await fetch(`${CF_API}/zones/${zoneId}/custom_hostnames`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      hostname,
      ssl: { method: sslMethod, type: 'dv', settings: { min_tls_version: '1.0' } },
    }),
  })

  if (createRes.ok) {
    const body = (await createRes.json()) as CfApiResponse<CfCustomHostname>
    return extractResult(body.result)
  }

  if (createRes.status === 409) {
    // Hostname already exists — fetch and return the existing record
    const listRes = await fetch(
      `${CF_API}/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}&limit=1`,
      { headers: authHeaders(token) },
    )
    const listBody = (await listRes.json()) as CfApiResponse<CfCustomHostname[]>
    const existing = listBody.result?.[0]
    if (!existing) {
      throw new Error(`Cloudflare: hostname ${hostname} reported as existing but not found in list`)
    }
    return extractResult(existing)
  }

  const errorBody = await createRes.json().catch(() => null) as CfApiResponse<unknown> | null
  const msg = errorBody?.errors?.[0]?.message ?? createRes.statusText
  throw new Error(`Cloudflare custom hostname creation failed (${createRes.status}): ${msg}`)
}

/**
 * Fetches the current verification and SSL status of a registered custom hostname.
 * Returns null if the hostname is not registered or credentials are missing.
 */
export async function getCustomHostnameStatus(hostname: string): Promise<CustomHostnameStatusResult | null> {
  let token: string, zoneId: string
  try {
    ;({ token, zoneId } = getConfig())
  } catch {
    return null
  }

  try {
    const res = await fetch(
      `${CF_API}/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}&limit=1`,
      { headers: authHeaders(token), cache: 'no-store' },
    )
    if (!res.ok) return null

    const body = (await res.json()) as CfApiResponse<CfCustomHostname[]>
    const record = body.result?.[0]
    if (!record) return null

    const toStatus = (s: string): HostnameVerificationStatus => {
      if (s === 'active') return 'active'
      if (['pending', 'initializing', 'pending_validation', 'pending_issuance', 'pending_deployment'].includes(s)) return 'pending'
      if (['blocked', 'moved', 'deleted'].includes(s)) return 'error'
      return 'unknown'
    }

    return {
      hostnameStatus: toStatus(record.status),
      sslStatus: toStatus(record.ssl?.status ?? ''),
      rawHostnameStatus: record.status,
      rawSslStatus: record.ssl?.status ?? '',
      ownershipTxtValue: record.ownership_verification?.value ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Fetches the zone's DCV delegation UUID from Cloudflare.
 * This UUID forms the stable CNAME target for _acme-challenge records:
 *   _acme-challenge.example.com  CNAME  example.com.{uuid}.dcv.cloudflare.com
 *
 * The client adds this CNAME once and Cloudflare handles all cert renewals
 * automatically — no more one-time _acme-challenge TXT values.
 *
 * Returns null if credentials are missing or the request fails.
 */
export async function getDcvDelegationUuid(): Promise<string | null> {
  let token: string, zoneId: string
  try {
    ;({ token, zoneId } = getConfig())
  } catch {
    return null
  }

  try {
    const res = await fetch(
      `${CF_API}/zones/${zoneId}/dcv_delegation/uuid`,
      { headers: authHeaders(token), next: { revalidate: 3600 } },
    )
    if (!res.ok) return null
    const body = (await res.json()) as CfApiResponse<{ uuid: string }>
    return body.result?.uuid ?? null
  } catch {
    return null
  }
}

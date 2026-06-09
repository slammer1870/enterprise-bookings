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

interface CfSslValidationRecord {
  status: string
  txt_name: string
  txt_value: string
}

interface CfCustomHostname {
  id: string
  hostname: string
  status: string
  verification_errors?: string[]
  ownership_verification?: {
    type: string
    name: string
    value: string
  }
  ssl?: {
    status: string
    method?: string
    validation_records?: CfSslValidationRecord[]
    dcv_delegation_records?: CfSslValidationRecord[]
  }
}

export type HostnameVerificationStatus = 'active' | 'pending' | 'error' | 'unknown'

export interface SslValidationRecord {
  status: HostnameVerificationStatus
  txtName: string
  txtValue: string
}

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
  /** ACME DCV TXT records (_acme-challenge) required for apex TXT validation */
  sslValidationRecords: SslValidationRecord[]
  /** Cloudflare hostname activation errors, if any */
  verificationErrors: string[]
}

interface CfApiResponse<T> {
  result: T
  success: boolean
  errors: Array<{ code: number; message: string }>
}

function getConfig(): { token: string; zoneId: string } | null {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim()
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim()

  if (!token || !zoneId) return null
  return { token, zoneId }
}

/** True when Cloudflare TLS for SaaS API credentials are available. */
export function isCloudflareConfigured(): boolean {
  return getConfig() != null
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

function toHostnameStatus(s: string): HostnameVerificationStatus {
  if (['active', 'staging_active', 'backup_issued'].includes(s)) return 'active'
  if (['pending', 'initializing', 'pending_validation', 'pending_issuance', 'pending_deployment'].includes(s)) {
    return 'pending'
  }
  if (['blocked', 'moved', 'deleted'].includes(s)) return 'error'
  return 'unknown'
}

function extractSslValidationRecords(record: CfCustomHostname): SslValidationRecord[] {
  const sources = [
    ...(record.ssl?.validation_records ?? []),
    ...(record.ssl?.dcv_delegation_records ?? []),
  ]

  return sources
    .filter((r) => r.txt_name && r.txt_value)
    .map((r) => ({
      status: toHostnameStatus(r.status),
      txtName: r.txt_name,
      txtValue: r.txt_value,
    }))
}

async function fetchCustomHostnameById(
  zoneId: string,
  token: string,
  id: string,
): Promise<CfCustomHostname | null> {
  const res = await fetch(`${CF_API}/zones/${zoneId}/custom_hostnames/${id}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const body = (await res.json()) as CfApiResponse<CfCustomHostname>
  return body.result ?? null
}

/**
 * Creates a Cloudflare TLS for SaaS custom hostname for the given domain,
 * or returns the existing one if it is already registered (idempotent).
 *
 * For subdomains (e.g. www.example.com) we use HTTP validation — Cloudflare
 * verifies ownership automatically once the CNAME is pointing to the zone.
 *
 * For apex domains (e.g. example.com) we use TXT validation. The client must
 * add TXT records at `_cf-custom-hostname.{hostname}` (ownership) and
 * `_acme-challenge.{hostname}` (SSL DCV) before the A record cutover.
 *
 * @param isApex - true for bare apex domains, false (default) for subdomains
 */
export async function createOrGetCustomHostname(
  hostname: string,
  isApex = false,
): Promise<CustomHostnameResult> {
  const config = getConfig()
  if (!config) {
    console.warn(
      `[cloudflare] Missing CLOUDFLARE_API_TOKEN/CLOUDFLARE_ZONE_ID — skipping custom hostname provisioning for "${hostname}"`,
    )
    return { id: '', verificationTxtValue: '', status: 'skipped' }
  }

  const { token, zoneId } = config

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

    // Re-trigger TXT DCV for apex hostnames created earlier with HTTP validation.
    if (isApex && existing.id) {
      const patchRes = await fetch(`${CF_API}/zones/${zoneId}/custom_hostnames/${existing.id}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({
          ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.0' } },
        }),
      })
      if (patchRes.ok) {
        const patchBody = (await patchRes.json()) as CfApiResponse<CfCustomHostname>
        return extractResult(patchBody.result)
      }
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
  const config = getConfig()
  if (!config) return null

  const { token, zoneId } = config

  try {
    const res = await fetch(
      `${CF_API}/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}&limit=1`,
      { headers: authHeaders(token), cache: 'no-store' },
    )
    if (!res.ok) return null

    const body = (await res.json()) as CfApiResponse<CfCustomHostname[]>
    const listed = body.result?.[0]
    if (!listed) return null

    // Detail endpoint includes validation_records that the list endpoint may omit.
    const record =
      listed.id != null
        ? (await fetchCustomHostnameById(zoneId, token, listed.id)) ?? listed
        : listed

    const sslValidationRecords = extractSslValidationRecords(record)

    return {
      hostnameStatus: toHostnameStatus(record.status),
      sslStatus: toHostnameStatus(record.ssl?.status ?? ''),
      rawHostnameStatus: record.status,
      rawSslStatus: record.ssl?.status ?? '',
      ownershipTxtValue: record.ownership_verification?.value ?? null,
      sslValidationRecords,
      verificationErrors: record.verification_errors ?? [],
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
  const config = getConfig()
  if (!config) return null

  const { token, zoneId } = config

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

/**
 * Resend Domains API client for tenant email-domain verification.
 * Uses RESEND_API_KEY (same key as transactional sending).
 */

const RESEND_API = 'https://api.resend.com'

export type ResendDnsRecord = {
  record: string
  name: string
  type: string
  ttl: string
  status: string
  value: string
  priority?: number
}

export type ResendDomain = {
  id: string
  name: string
  status: string
  records: ResendDnsRecord[]
  region?: string
}

export type EmailDomainStatus =
  | 'not_configured'
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'failed'

export function mapResendStatusToEmailDomainStatus(status: string | null | undefined): EmailDomainStatus {
  const s = (status || '').toLowerCase().trim()
  switch (s) {
    case 'verified':
    case 'partially_verified':
      return 'verified'
    case 'pending':
      return 'pending'
    case 'not_started':
      return 'not_started'
    case 'failed':
    case 'partially_failed':
      return 'failed'
    default:
      return s ? 'failed' : 'not_configured'
  }
}

function getApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim()
  return key || null
}

async function resendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { ok: false, status: 0, body: 'RESEND_API_KEY is not set' }
  }

  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, status: res.status, body }
  }

  const data = (await res.json()) as T
  return { ok: true, data }
}

function normalizeDomainPayload(raw: any): ResendDomain {
  return {
    id: String(raw?.id || ''),
    name: String(raw?.name || ''),
    status: String(raw?.status || 'not_started'),
    records: Array.isArray(raw?.records) ? raw.records : [],
    region: typeof raw?.region === 'string' ? raw.region : undefined,
  }
}

export async function createDomain(name: string): Promise<ResendDomain | null> {
  if (!getApiKey()) {
    console.warn('[resend/domains] RESEND_API_KEY not set — skipping createDomain')
    return null
  }

  const result = await resendFetch<any>('/domains', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })

  if (result.ok) return normalizeDomainPayload(result.data)

  // Already exists — fall through for createOrGetDomain
  if (result.status === 409 || /already|exist/i.test(result.body)) {
    return null
  }

  console.error(`[resend/domains] createDomain failed (${result.status}):`, result.body)
  return null
}

export async function listDomains(): Promise<ResendDomain[]> {
  if (!getApiKey()) return []

  const result = await resendFetch<{ data?: any[] }>('/domains')
  if (!result.ok) {
    console.error(`[resend/domains] listDomains failed (${result.status}):`, result.body)
    return []
  }
  const list = Array.isArray(result.data?.data) ? result.data.data : Array.isArray(result.data) ? result.data : []
  return list.map(normalizeDomainPayload)
}

export async function getDomain(id: string): Promise<ResendDomain | null> {
  if (!getApiKey() || !id) return null

  const result = await resendFetch<any>(`/domains/${encodeURIComponent(id)}`)
  if (!result.ok) {
    console.error(`[resend/domains] getDomain failed (${result.status}):`, result.body)
    return null
  }
  return normalizeDomainPayload(result.data)
}

export async function createOrGetDomain(name: string): Promise<ResendDomain | null> {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null
  if (!getApiKey()) {
    console.warn('[resend/domains] RESEND_API_KEY not set — skipping createOrGetDomain')
    return null
  }

  const created = await createDomain(normalized)
  if (created?.id) return created

  // Lookup existing by name
  const listed = await listDomains()
  const existing = listed.find((d) => d.name.toLowerCase() === normalized)
  if (!existing?.id) return null

  // List may omit records — fetch full domain
  return (await getDomain(existing.id)) || existing
}

export async function verifyDomain(id: string): Promise<ResendDomain | null> {
  if (!getApiKey() || !id) return null

  const verifyResult = await resendFetch<any>(`/domains/${encodeURIComponent(id)}/verify`, {
    method: 'POST',
  })
  if (!verifyResult.ok) {
    console.error(`[resend/domains] verifyDomain failed (${verifyResult.status}):`, verifyResult.body)
    // Still re-fetch current status
  }

  return await getDomain(id)
}

export async function deleteDomain(id: string): Promise<boolean> {
  if (!getApiKey() || !id) return false

  const result = await resendFetch<any>(`/domains/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!result.ok && result.status !== 404) {
    console.error(`[resend/domains] deleteDomain failed (${result.status}):`, result.body)
    return false
  }
  return true
}

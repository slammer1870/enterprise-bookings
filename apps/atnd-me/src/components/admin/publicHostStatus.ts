export type StatusLabel = 'Active' | 'Pending' | 'Error' | 'Unknown'

const DNS_ERROR = new Set(['blocked', 'moved', 'deleted'])

/** DNS Active is `active` or `active_redeploying`. Pending is `pending`. Error is `blocked`, `moved`, or `deleted`. */
export function dnsStatusLabel(raw: string | null | undefined): StatusLabel {
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
  'staging_deployment',
  'staging_active',
  'backup_issued',
])

/**
 * Certificate Active is Cloudflare SSL `active` only. The issuance pipeline
 * through deployment stays Pending, including `staging_active` and `backup_issued`.
 * `staging_deployment` is the staging equivalent of `pending_deployment`.
 */
export function certificateStatusLabel(raw: string | null | undefined): StatusLabel {
  if (raw === 'active') return 'Active'
  if (raw != null && CERTIFICATE_PENDING.has(raw)) return 'Pending'
  return 'Unknown'
}

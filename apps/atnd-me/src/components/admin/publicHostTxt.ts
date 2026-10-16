import type { CustomHostnameStatusResult, TxtRecord } from '@/lib/cloudflare/customHostnames'
import { certificateStatusLabel, dnsStatusLabel, type StatusLabel } from './publicHostStatus'

/**
 * Cloudflare's custom hostname object has no zone flag. A zone already on
 * Cloudflare is reported only as this activation error.
 */
const ZONE_ON_CLOUDFLARE = /hostname is using cloudflare and cannot be activated/i

function zoneAlreadyOnCloudflare(verificationErrors: readonly string[]): boolean {
  return verificationErrors.some((error) => ZONE_ON_CLOUDFLARE.test(error))
}

/** Show an issued TXT only while its status is not Active and the zone is not already on Cloudflare. */
function issuedTxtVisible(
  status: CustomHostnameStatusResult | null,
  label: StatusLabel,
): status is CustomHostnameStatusResult {
  return status != null && label !== 'Active' && !zoneAlreadyOnCloudflare(status.verificationErrors)
}

/** Ownership TXT while DNS status is not Active and Cloudflare has issued it. Hidden when the zone is already on Cloudflare. */
export function ownershipTxtToShow(status: CustomHostnameStatusResult | null): TxtRecord | null {
  if (!issuedTxtVisible(status, dnsStatusLabel(status?.rawHostnameStatus))) return null
  return status.ownershipTxt
}

/** Each `_acme-challenge` TXT while certificate status is not Active. Delegated DCV stays off the list. */
export function acmeTxtsToShow(status: CustomHostnameStatusResult | null): TxtRecord[] {
  if (!issuedTxtVisible(status, certificateStatusLabel(status?.rawSslStatus))) return []
  return status.sslValidationRecords.filter(
    (record) => record.name.includes('_acme-challenge') && !record.value.includes('dcv.cloudflare.com'),
  )
}

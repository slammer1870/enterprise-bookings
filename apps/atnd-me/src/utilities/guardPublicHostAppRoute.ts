import { notFound } from 'next/navigation'

import { publicHostErrorResponse } from '@/utilities/publicHostOutcome'
import {
  resolvePublicHostLookup,
  type PublicHostLookupResult,
} from '@/utilities/resolvePublicHostLookup'
import { getRequestHostname } from '@/utilities/tenantRequest'

export function abortOnPublicHostOutcome(lookup: PublicHostLookupResult): void {
  if (lookup.kind === 'platform' || lookup.kind === 'tenant') return
  if (lookup.kind === 'unknown') {
    notFound()
    return
  }
  if (lookup.kind === 'failed') {
    throw publicHostErrorResponse('failed')
  }
}

export async function guardPublicHostAppRoute(headers: Headers): Promise<void> {
  const hostname = getRequestHostname(headers)
  if (!hostname) return
  abortOnPublicHostOutcome(await resolvePublicHostLookup(hostname, headers))
}

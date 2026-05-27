/**
 * Pure logic for the Tenants afterChange apex domain hook.
 * Extracted so it can be unit-tested without Payload or the DB.
 */
import { stripFirstLabel } from '@/utilities/validateCustomDomain'

type ApexHookDocShape = {
  domain?: string | null
  redirectApex?: boolean | null
  apexDomain?: string | null
}

type ApexHookPrevShape = {
  domain?: string | null
  redirectApex?: boolean | null
}

export type ApexActions = {
  /** Apex hostname to register with Apple Pay. Null = nothing to do. */
  registerApexApplePay: string | null
  /** Derived apex value to write to the apexDomain column. Null = clear it. */
  apexDomainToStore: string | null
  /** When true, clear the apexDomain column (redirectApex was toggled off). */
  clearApex: boolean
  /** Main custom domain to register as a Cloudflare TLS for SaaS custom hostname. Null = no change needed. */
  registerDomain: string | null
}

type CollectArgs = {
  doc: ApexHookDocShape
  previousDoc: ApexHookPrevShape
  operation: 'create' | 'update'
}

/**
 * Determines what apex-related actions are required after a Tenants save.
 *
 * Returns a plain object so callers (hook + tests) can drive their own side
 * effects (Cloudflare API, Payload update, Apple Pay registration) independently.
 */
export function collectApexActionsFromHookArgs({ doc, previousDoc, operation }: CollectArgs): ApexActions {
  const redirectApex = Boolean(doc.redirectApex)
  const prevRedirectApex = Boolean(previousDoc.redirectApex)
  const domain = typeof doc.domain === 'string' && doc.domain.trim() ? doc.domain.trim() : null
  const prevDomain = typeof previousDoc.domain === 'string' && previousDoc.domain.trim() ? previousDoc.domain.trim() : null

  // Main custom domain: register with Cloudflare whenever it is new or changed
  const domainChanged = domain !== prevDomain
  const registerDomain = domain && (operation === 'create' || domainChanged) ? domain : null

  // redirectApex toggled off — clear apex field but still handle domain registration above
  if (!redirectApex && prevRedirectApex) {
    return { registerApexApplePay: null, apexDomainToStore: null, clearApex: true, registerDomain }
  }

  // redirectApex is off — no apex work needed
  if (!redirectApex) {
    return { registerApexApplePay: null, apexDomainToStore: null, clearApex: false, registerDomain }
  }

  // redirectApex is on — check if anything changed that requires (re-)registration
  const apexTurnedOn = redirectApex && !prevRedirectApex

  if (!domainChanged && !apexTurnedOn && operation !== 'create') {
    return { registerApexApplePay: null, apexDomainToStore: null, clearApex: false, registerDomain }
  }

  if (!domain) {
    return { registerApexApplePay: null, apexDomainToStore: null, clearApex: false, registerDomain }
  }

  const apex = stripFirstLabel(domain)
  if (!apex) {
    return { registerApexApplePay: null, apexDomainToStore: null, clearApex: false, registerDomain }
  }

  return { registerApexApplePay: apex, apexDomainToStore: apex, clearApex: false, registerDomain }
}

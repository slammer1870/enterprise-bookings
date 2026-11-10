/**
 * Cloudflare custom hostnames to register when a tenant is saved.
 * The first hostname is the former custom domain. Redirect to www also
 * registers that hostname's parent, the way Redirect apex used to.
 * An alias host is not registered. Removing a hostname does not delete it.
 */
import { parseDirection } from '@/utilities/hostnameDirection'
import { storedHostnameList } from '@/utilities/tenantPublicHostDeclaration'
import { stripFirstLabel } from '@/utilities/validateCustomDomain'

export type CustomHostnameRegistration = {
  hostname: string
  isApex: boolean
}

export function customHostnamesToRegister(args: {
  operation: 'create' | 'update'
  hostnames: unknown
  previousHostnames?: unknown
  direction?: unknown
  previousDirection?: unknown
}): CustomHostnameRegistration[] {
  const next = storedHostnameList(args.hostnames) ?? []
  const previous =
    args.operation === 'create' ? [] : (storedHostnameList(args.previousHostnames) ?? [])
  const domain = next[0] ?? null
  const previousDomain = previous[0] ?? null
  const domainChanged = domain !== previousDomain
  const redirectToWww = parseDirection(args.direction) === 'redirect-to-www'
  const previousRedirectToWww =
    args.operation !== 'create' && parseDirection(args.previousDirection) === 'redirect-to-www'

  const registrations: CustomHostnameRegistration[] = []
  if (domain && (args.operation === 'create' || domainChanged)) {
    registrations.push({ hostname: domain, isApex: false })
  }

  if (!redirectToWww || !domain) return registrations

  const apexTurnedOn = !previousRedirectToWww
  if (args.operation !== 'create' && !domainChanged && !apexTurnedOn) return registrations

  const apex = stripFirstLabel(domain)
  if (!apex) return registrations
  registrations.push({ hostname: apex, isApex: true })
  return registrations
}

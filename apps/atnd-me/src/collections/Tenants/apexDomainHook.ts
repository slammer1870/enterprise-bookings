/**
 * Hostnames to register with Cloudflare when a tenant is saved.
 * Each named hostname is registered once. An apex uses TXT validation.
 * Removing a hostname does not delete the Cloudflare hostname.
 */
import { getClaimedApex } from '@/utilities/hostnameDirection'
import { storedHostnameList } from '@/utilities/tenantPublicHostDeclaration'

export type CustomHostnameRegistration = {
  hostname: string
  isApex: boolean
}

export function customHostnamesToRegister(args: {
  operation: 'create' | 'update'
  hostnames: unknown
  previousHostnames?: unknown
}): CustomHostnameRegistration[] {
  const next = storedHostnameList(args.hostnames) ?? []
  const previous =
    args.operation === 'create' ? [] : (storedHostnameList(args.previousHostnames) ?? [])
  const already = new Set(previous)
  return next
    .filter((hostname) => !already.has(hostname))
    .map((hostname) => ({
      hostname,
      isApex: getClaimedApex(hostname) === hostname,
    }))
}

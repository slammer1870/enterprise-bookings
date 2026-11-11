/**
 * Cloudflare custom hostnames to keep in step with a saved hostname list.
 * Every saved hostname is registered. A hostname that leaves the list is removed.
 * An apex uses TXT validation only when leased Apex Proxying addresses are configured.
 * Otherwise every hostname, including an apex, uses HTTP so a Cloudflare CNAME at the apex keeps working.
 */
import { hasApexProxyingRecords } from '@/components/admin/apexProxying'
import { getClaimedApex, parseDirection } from '@/utilities/hostnameDirection'
import { storedHostnameList } from '@/utilities/tenantPublicHostDeclaration'
import { stripFirstLabel } from '@/utilities/validateCustomDomain'

export type CustomHostnameRegistration = {
  hostname: string
  isApex: boolean
}

export type CustomHostnameSyncPlan = {
  ensure: CustomHostnameRegistration[]
  remove: string[]
}

function registrationFor(hostname: string, leasedApexProxying: boolean): CustomHostnameRegistration {
  return {
    hostname,
    isApex: leasedApexProxying && hostname === getClaimedApex(hostname),
  }
}

/**
 * Parent the previous hook registered for Redirect to www when that parent was not saved.
 * Null unless it is the registrable apex, so a public suffix such as `co.uk` is left alone.
 */
function legacyUnlistedParent(previous: string[], previousDirection: unknown): string | null {
  if (parseDirection(previousDirection) !== 'redirect-to-www') return null
  const first = previous[0]
  if (!first) return null
  const parent = stripFirstLabel(first)
  if (!parent || parent !== getClaimedApex(first)) return null
  return parent
}

function queueRemoval(remove: string[], next: ReadonlySet<string>, hostname: string): void {
  if (next.has(hostname) || remove.includes(hostname)) return
  remove.push(hostname)
}

export function customHostnameSync(args: {
  operation: 'create' | 'update'
  hostnames: unknown
  previousHostnames?: unknown
  previousDirection?: unknown
}): CustomHostnameSyncPlan {
  const next = storedHostnameList(args.hostnames) ?? []
  const previous =
    args.operation === 'create' ? [] : (storedHostnameList(args.previousHostnames) ?? [])
  const leasedApexProxying = hasApexProxyingRecords()
  const nextSet = new Set(next)
  const remove: string[] = []

  for (const hostname of previous) queueRemoval(remove, nextSet, hostname)

  if (args.operation !== 'create') {
    const parent = legacyUnlistedParent(previous, args.previousDirection)
    if (parent) queueRemoval(remove, nextSet, parent)
  }

  return {
    ensure: next.map((hostname) => registrationFor(hostname, leasedApexProxying)),
    remove,
  }
}

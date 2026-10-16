import { parse as parseHostname } from 'tldts'

export const HOSTNAME_DIRECTIONS = [
  'allow-www-and-non-www',
  'redirect-to-www',
  'redirect-to-non-www',
] as const

export type Direction = (typeof HOSTNAME_DIRECTIONS)[number]

export const DEFAULT_DIRECTION: Direction = 'allow-www-and-non-www'

export const DIRECTION_CHOICES: Array<{ label: string; value: Direction }> = [
  { label: 'Allow www and non-www', value: 'allow-www-and-non-www' },
  { label: 'Redirect to www', value: 'redirect-to-www' },
  { label: 'Redirect to non-www', value: 'redirect-to-non-www' },
]

export function getClaimedApex(hostname: string): string {
  const normalized = hostname.trim().toLowerCase()
  const parsed = parseHostname(normalized, { allowPrivateDomains: true })
  if (parsed.domain) return parsed.domain
  const labels = normalized.split('.').filter(Boolean)
  if (labels.length >= 2) return labels.slice(-2).join('.')
  return normalized
}

export function parseDirection(value: unknown): Direction {
  if (
    value === 'allow-www-and-non-www' ||
    value === 'redirect-to-www' ||
    value === 'redirect-to-non-www'
  ) {
    return value
  }
  return DEFAULT_DIRECTION
}

function wwwHostOf(apex: string): string {
  return `www.${apex}`
}

/**
 * Canonical host for a saved hostname list.
 * `www` of the first hostname's registrable domain when Direction is Redirect to www and that
 * `www` host is named; otherwise that apex when it is named; otherwise the first hostname.
 */
export function canonicalHostFromList(hostnames: string[], direction: Direction): string {
  const first = hostnames[0]
  if (!first) return ''
  const apex = getClaimedApex(first)
  const www = wwwHostOf(apex)
  const named = new Set(hostnames)
  if (direction === 'redirect-to-www' && named.has(www)) return www
  if (named.has(apex)) return apex
  return first
}

/** Why this Direction cannot be saved for this list. Null when the list can take it. */
export function directionRefusal(hostnames: string[], direction: Direction): string | null {
  if (direction === 'allow-www-and-non-www') return null
  const first = hostnames[0]
  if (!first) {
    if (direction === 'redirect-to-www') {
      return 'Redirect to www needs www of the first hostname in the list.'
    }
    return 'Redirect to non-www needs the apex of the first hostname in the list.'
  }
  const apex = getClaimedApex(first)
  const www = wwwHostOf(apex)
  const named = new Set(hostnames)
  if (direction === 'redirect-to-www' && !named.has(www)) {
    return `Redirect to www needs ${www} in the hostname list.`
  }
  if (direction === 'redirect-to-non-www' && !named.has(apex)) {
    return `Redirect to non-www needs ${apex} in the hostname list.`
  }
  return null
}

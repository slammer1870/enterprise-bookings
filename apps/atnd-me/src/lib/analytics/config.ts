const DEFAULT_UMAMI_DOMAINS = ['brugrappling.ie', 'www.brugrappling.ie'] as const

type UmamiEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, 'UMAMI_WEBSITE_ID' | 'UMAMI_SCRIPT_URL' | 'UMAMI_DOMAINS'>
>

type UmamiAnalyticsConfigBase = {
  domains: string[]
  domainsAttribute: string
}

export type UmamiAnalyticsConfig =
  | (UmamiAnalyticsConfigBase & {
      enabled: true
      websiteId: string
      scriptUrl: string
    })
  | (UmamiAnalyticsConfigBase & {
      enabled: false
      websiteId: string | undefined
      scriptUrl: string | undefined
    })

export function parseUmamiDomains(value?: string): string[] {
  const configured = value?.trim() ? value.split(',') : DEFAULT_UMAMI_DOMAINS

  return [...new Set(configured.map((domain) => domain.trim().toLowerCase()).filter(Boolean))]
}

function hostnameMatchesDomain(hostname: string, domain: string): boolean {
  if (!domain.startsWith('*.')) return hostname === domain

  const suffix = domain.slice(1)
  return hostname.endsWith(suffix) && hostname.length > suffix.length
}

function resolveSafeScriptUrl(value?: string): string | undefined {
  const candidate = value?.trim()
  if (!candidate) return undefined

  try {
    const url = new URL(candidate)
    const isLocalDevelopmentHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)

    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalDevelopmentHost)) ||
      url.username ||
      url.password
    ) {
      return undefined
    }

    return url.toString()
  } catch {
    return undefined
  }
}

export function resolveUmamiAnalyticsConfig(
  hostname: string | null,
  env: UmamiEnvironment = {
    UMAMI_WEBSITE_ID: process.env.UMAMI_WEBSITE_ID,
    UMAMI_SCRIPT_URL: process.env.UMAMI_SCRIPT_URL,
    UMAMI_DOMAINS: process.env.UMAMI_DOMAINS,
  },
): UmamiAnalyticsConfig {
  const websiteId = env.UMAMI_WEBSITE_ID?.trim() || undefined
  const scriptUrl = resolveSafeScriptUrl(env.UMAMI_SCRIPT_URL)
  const domains = parseUmamiDomains(env.UMAMI_DOMAINS)
  const normalizedHostname = hostname?.trim().toLowerCase()
  const matchesCurrentHostname = Boolean(
    normalizedHostname &&
    domains.some((domain) => hostnameMatchesDomain(normalizedHostname, domain)),
  )
  const trackerDomains = [
    ...new Set(
      domains
        .map((domain) =>
          normalizedHostname && hostnameMatchesDomain(normalizedHostname, domain)
            ? normalizedHostname
            : domain,
        )
        .filter((domain) => !domain.startsWith('*')),
    ),
  ]
  const common = { domains, domainsAttribute: trackerDomains.join(',') }

  if (websiteId && scriptUrl && matchesCurrentHostname) {
    return { enabled: true, websiteId, scriptUrl, ...common }
  }

  return { enabled: false, websiteId, scriptUrl, ...common }
}

import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Generate trusted origins for Better Auth, including wildcard patterns for tenant subdomains.
 * 
 * For development: Includes http://localhost:3000 and http://*.localhost:3000
 * For production: Includes the base domain and https://*.{domain}
 */
function getTrustedOrigins(): string[] {
  const baseURL = getServerSideURL()
  const url = new URL(baseURL)
  const isLocalhost = url.hostname.includes('localhost')
  const protocol = url.protocol
  const hostname = url.hostname
  const port = url.port ? `:${url.port}` : ''

  const origins: string[] = [baseURL] // Always include the base URL

  if (isLocalhost) {
    // For development: Allow all localhost subdomains
    // Pattern: http://*.localhost:3000
    origins.push(`${protocol}//*.localhost${port}`)
  } else {
    // For production: Allow all subdomains of the base domain
    // Extract the root domain (e.g., "atnd-me.com" from "app.atnd-me.com")
    const hostnameParts = hostname.split('.')
    if (hostnameParts.length >= 2) {
      // Get the last two parts (domain.tld)
      const rootDomain = hostnameParts.slice(-2).join('.')
      // Pattern: https://*.atnd-me.com
      origins.push(`${protocol}//*.${rootDomain}`)
    }
  }

  return origins
}

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'ATND ME',
  adminUserIds: ['1'],
  enableMagicLink: true,
  magicLinkDisableSignUp: true,
  includeMagicLinkOptionConfig: true,
  disableDefaultPayloadAuth: false,
  hidePluginCollections: true,
  trustedOrigins: getTrustedOrigins(),
  roles: {
    adminRoles: ['admin'], // Both admin and tenant-admin can access admin panel
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin', 'tenant-admin'],
    allowedFields: ['name'],
  },
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions

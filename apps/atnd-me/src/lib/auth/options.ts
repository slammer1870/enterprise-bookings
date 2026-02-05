import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Generate trusted origins for Better Auth, including wildcard patterns for tenant subdomains.
 * Exported for unit tests.
 */
export function getTrustedOrigins(): string[] {
  const baseURL = getServerSideURL()
  const url = new URL(baseURL)
  const isLocalhost = url.hostname.includes('localhost')
  const protocol = url.protocol
  const hostname = url.hostname
  const port = url.port ? `:${url.port}` : ''

  const origins: string[] = [baseURL] // Always include the base URL

  if (isLocalhost) {
    origins.push(`${protocol}//*.localhost${port}`)
  } else {
    // Use full hostname so *.atnd-me.com works (not *.me.com)
    origins.push(`${protocol}//*.${hostname}`)
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
    adminRoles: ['admin', 'tenant-admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin', 'tenant-admin'],
    allowedFields: ['name'],
  },
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions

import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'Kyuzo',
  adminUserIds: ['1'],
  enableMagicLink: false,
  disableDefaultPayloadAuth: false,
  hidePluginCollections: false,
  sessionCookieCache: {
    enabled: true,
    maxAge: 5 * 60,
  },
  roles: {
    adminRoles: ['admin'],
    defaultRole: 'customer',
    defaultAdminRole: 'admin',
    roles: ['customer', 'admin'],
    allowedFields: ['name'],
  },
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions








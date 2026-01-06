import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'Mindful Yard',
  adminUserIds: ['1'],
  enableMagicLink: true,
  disableDefaultPayloadAuth: true,
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








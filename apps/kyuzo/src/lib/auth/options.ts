import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'Kyuzo',
  adminUserIds: ['1'],
  enableMagicLink: false,
  disableDefaultPayloadAuth: false,
  hidePluginCollections: false,

  roles: {
    adminRoles: ['admin'],
    defaultRole: 'customer',
    defaultAdminRole: 'admin',
    roles: ['customer', 'admin'],
    allowedFields: ['name'],
  },
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions

import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'Darkhorse Strength',
  adminUserIds: ['1'],
  enableMagicLink: true,
  disableDefaultPayloadAuth: false,
  hidePluginCollections: false,
  roles: {
    adminRoles: ['admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin'],
    allowedFields: ['name'],
  },
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions








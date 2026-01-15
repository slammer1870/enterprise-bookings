import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'Brú Grappling',
  adminUserIds: ['1'],
  enableMagicLink: true,
  magicLinkDisableSignUp: true,
  includeMagicLinkOptionConfig: true,
  disableDefaultPayloadAuth: false,
  hidePluginCollections: true,
  roles: {
    adminRoles: ['admin'],
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin'],
    allowedFields: ['name'],
  },
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions

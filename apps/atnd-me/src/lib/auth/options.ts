import { createBetterAuthPluginOptions } from '@repo/better-auth-config/server'

export const betterAuthPluginOptions = createBetterAuthPluginOptions({
  appName: 'ATND ME',
  adminUserIds: ['1'],
  enableMagicLink: true,
  magicLinkDisableSignUp: true,
  includeMagicLinkOptionConfig: true,
  disableDefaultPayloadAuth: false,
  hidePluginCollections: true,
  roles: {
    adminRoles: ['admin'], // Both admin and tenant-admin can access admin panel
    defaultRole: 'user',
    defaultAdminRole: 'admin',
    roles: ['user', 'admin', 'tenant-admin'],
    allowedFields: ['name'],
  },
})

export type ConstructedBetterAuthPluginOptions = typeof betterAuthPluginOptions

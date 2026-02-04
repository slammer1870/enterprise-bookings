import { describe, it, expect } from 'vitest'
import { betterAuthPluginOptions } from '../../src/lib/auth/options'

/**
 * Step 1 - Tenant-admin admin panel access
 *
 * The Better Auth plugin uses `adminRoles` to determine which roles can access
 * the admin panel. Tenant-admins must be included so they can manage their
 * tenant's data.
 *
 * These tests verify the auth configuration includes tenant-admin in adminRoles.
 */
describe('Admin roles auth config (tenant-admin panel access)', () => {
  it('adminRoles includes admin', () => {
    const adminRoles = betterAuthPluginOptions.users?.adminRoles ?? []
    expect(adminRoles).toContain('admin')
  })

  it('adminRoles includes tenant-admin so tenant-admins can access the admin panel', () => {
    const adminRoles = betterAuthPluginOptions.users?.adminRoles ?? []
    expect(adminRoles).toContain('tenant-admin')
  })

  it('adminRoles does not include user (regular users cannot access admin panel)', () => {
    const adminRoles = betterAuthPluginOptions.users?.adminRoles ?? []
    expect(adminRoles).not.toContain('user')
  })
})

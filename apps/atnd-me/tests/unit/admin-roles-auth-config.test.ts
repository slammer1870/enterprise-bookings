import { describe, it, expect } from 'vitest'
import { betterAuthPluginOptions } from '../../src/lib/auth/options'

/**
 * Better Auth uses `adminRoles` for admin panel access.
 * atnd-me: super-admin (platform), admin (org), staff (operational).
 */
describe('Admin roles auth config', () => {
  it('adminRoles includes super-admin, org admin, and staff', () => {
    const adminRoles = betterAuthPluginOptions.users?.adminRoles ?? []
    expect(adminRoles).toEqual(
      expect.arrayContaining(['super-admin', 'admin', 'staff']),
    )
  })

  it('adminRoles does not include user (regular users cannot access admin panel)', () => {
    const adminRoles = betterAuthPluginOptions.users?.adminRoles ?? []
    expect(adminRoles).not.toContain('user')
  })
})

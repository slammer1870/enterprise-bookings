import { describe, it, expect } from 'vitest'
import { betterAuthPluginOptions } from '../../src/lib/auth/options'

/**
 * Better Auth uses `adminRoles` for admin panel access.
 * atnd-me: super-admin (platform), admin (org), staff (operational), location-manager (branch scope).
 */
describe('Admin roles auth config', () => {
  it('adminRoles includes super-admin, org admin, staff, and location-manager', () => {
    const adminRoles = betterAuthPluginOptions.users?.adminRoles ?? []
    expect(adminRoles).toEqual(
      expect.arrayContaining(['super-admin', 'admin', 'staff', 'location-manager']),
    )
  })

  it('adminRoles does not include user (regular users cannot access admin panel)', () => {
    const adminRoles = betterAuthPluginOptions.users?.adminRoles ?? []
    expect(adminRoles).not.toContain('user')
  })

  it('registers exactly one custom-session plugin (no duplicate get-session routes)', () => {
    const plugins = betterAuthPluginOptions.betterAuthOptions?.plugins ?? []
    const customSessionCount = plugins.filter(
      (plugin) => (plugin as { id?: string } | undefined)?.id === 'custom-session',
    ).length
    expect(customSessionCount).toBe(1)
  })
})

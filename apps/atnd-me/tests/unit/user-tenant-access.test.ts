import { describe, it, expect } from 'vitest'
import { isAdmin, isTenantAdmin } from '../../src/access/userTenantAccess'

/**
 * Unit tests for user access helpers (isAdmin, isTenantAdmin).
 * Ensures both role (Better Auth singular) and roles (Payload/rolesPlugin plural) are recognized
 * so tenant-admins and admins are correctly identified for access control and field-level access.
 */
describe('isAdmin', () => {
  it('returns true when user has roles array containing admin', () => {
    expect(isAdmin({ id: 1, roles: ['admin'] })).toBe(true)
    expect(isAdmin({ id: 1, roles: ['admin', 'tenant-admin'] })).toBe(true)
  })

  it('returns true when user has role (singular) array containing admin', () => {
    expect(isAdmin({ id: 1, role: ['admin'] })).toBe(true)
    expect(isAdmin({ id: 1, role: ['admin', 'user'] })).toBe(true)
  })

  it('returns true when user has role (singular) string admin', () => {
    expect(isAdmin({ id: 1, role: 'admin' })).toBe(true)
  })

  it('returns false when user has no admin', () => {
    expect(isAdmin({ id: 1, roles: ['user'] })).toBe(false)
    expect(isAdmin({ id: 1, roles: ['tenant-admin'] })).toBe(false)
    expect(isAdmin({ id: 1, role: ['user'] })).toBe(false)
    expect(isAdmin({ id: 1, role: 'user' })).toBe(false)
  })

  it('returns false when user is null or undefined', () => {
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })
})

describe('isTenantAdmin', () => {
  it('returns true when user has roles array containing tenant-admin', () => {
    expect(isTenantAdmin({ id: 1, roles: ['tenant-admin'] })).toBe(true)
    expect(isTenantAdmin({ id: 1, roles: ['tenant-admin', 'user'] })).toBe(true)
  })

  it('returns true when user has role (singular) array containing tenant-admin', () => {
    expect(isTenantAdmin({ id: 1, role: ['tenant-admin'] })).toBe(true)
    expect(isTenantAdmin({ id: 1, role: ['tenant-admin', 'user'] })).toBe(true)
  })

  it('returns true when user has role (singular) string tenant-admin', () => {
    expect(isTenantAdmin({ id: 1, role: 'tenant-admin' })).toBe(true)
  })

  it('returns false when user has no tenant-admin', () => {
    expect(isTenantAdmin({ id: 1, roles: ['user'] })).toBe(false)
    expect(isTenantAdmin({ id: 1, roles: ['admin'] })).toBe(false)
    expect(isTenantAdmin({ id: 1, role: ['user'] })).toBe(false)
    expect(isTenantAdmin({ id: 1, role: 'user' })).toBe(false)
  })

  it('returns false when user is null or undefined', () => {
    expect(isTenantAdmin(null)).toBe(false)
    expect(isTenantAdmin(undefined)).toBe(false)
  })
})

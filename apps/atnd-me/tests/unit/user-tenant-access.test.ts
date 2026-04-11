import { describe, it, expect } from 'vitest'
import { isAdmin, isStaff, isTenantAdmin } from '@/access/userTenantAccess'

/**
 * Unit tests for userTenantAccess helpers used in multi-tenant Payload access control.
 */
describe('userTenantAccess helpers', () => {
  describe('isAdmin (platform super-admin)', () => {
    it('returns true when user has super-admin', () => {
      expect(isAdmin({ id: 1, role: ['super-admin'] })).toBe(true)
      expect(isAdmin({ id: 1, role: ['super-admin', 'user'] })).toBe(true)
    })

    it('returns true when singular role is super-admin', () => {
      expect(isAdmin({ id: 1, role: 'super-admin' })).toBe(true)
      expect(isAdmin({ id: 1, role: ['super-admin', 'user'] })).toBe(true)
    })

    it('returns false for org admin, staff, and regular users', () => {
      expect(isAdmin({ id: 1, role: ['admin'] })).toBe(false)
      expect(isAdmin({ id: 1, role: ['staff'] })).toBe(false)
      expect(isAdmin({ id: 1, role: ['user'] })).toBe(false)
    })
  })

  describe('isTenantAdmin (org admin)', () => {
    it('returns true when user has org admin role', () => {
      expect(isTenantAdmin({ id: 1, role: ['admin'] })).toBe(true)
      expect(isTenantAdmin({ id: 1, role: ['admin', 'user'] })).toBe(true)
    })

    it('returns true when singular role is admin', () => {
      expect(isTenantAdmin({ id: 1, role: ['admin'] })).toBe(true)
      expect(isTenantAdmin({ id: 1, role: ['admin', 'user'] })).toBe(true)
      expect(isTenantAdmin({ id: 1, role: 'admin' })).toBe(true)
    })

    it('returns false when user has no org admin', () => {
      expect(isTenantAdmin({ id: 1, role: ['user'] })).toBe(false)
      expect(isTenantAdmin({ id: 1, role: ['super-admin'] })).toBe(false)
    })
  })

  describe('isStaff', () => {
    it('returns true when user has staff role', () => {
      expect(isStaff({ id: 1, role: ['staff'] })).toBe(true)
      expect(isStaff({ id: 1, role: ['staff', 'user'] })).toBe(true)
    })

    it('returns false otherwise', () => {
      expect(isStaff({ id: 1, role: ['user'] })).toBe(false)
      expect(isStaff({ id: 1, role: ['admin'] })).toBe(false)
    })
  })
})

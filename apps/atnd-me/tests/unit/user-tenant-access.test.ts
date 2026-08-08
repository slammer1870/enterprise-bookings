import { describe, it, expect } from 'vitest'
import { isPureLocationManager } from '@/access/locationManagerScope'
import {
  isAdmin,
  isStaff,
  isStaffOnlyUser,
  isTenantAdmin,
  isTenantPortalUser,
  tenantOrgPayloadAdminAccess,
} from '@/access/userTenantAccess'

/**
 * Unit tests for userTenantAccess helpers used in multi-tenant Payload access control.
 * Org roles come from tenants[n].roles; global role is only for platform super-admin.
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
      expect(
        isAdmin({
          id: 1,
          tenants: [{ tenant: 7, roles: ['admin'] }],
        }),
      ).toBe(false)
    })
  })

  describe('isTenantAdmin (org admin)', () => {
    it('returns true from tenants[n].roles', () => {
      expect(
        isTenantAdmin({
          id: 1,
          tenants: [{ tenant: 7, roles: ['admin'] }],
        }),
      ).toBe(true)
      expect(
        isTenantAdmin({
          id: 1,
          tenants: [
            { tenant: 7, roles: ['user'] },
            { tenant: 8, roles: ['admin'] },
          ],
        }),
      ).toBe(true)
    })

    it('ignores derived/global role alone', () => {
      expect(isTenantAdmin({ id: 1, role: ['admin'] })).toBe(false)
      expect(isTenantAdmin({ id: 1, role: 'admin' })).toBe(false)
    })

    it('returns false when user has no org admin membership', () => {
      expect(isTenantAdmin({ id: 1, role: ['user'] })).toBe(false)
      expect(isTenantAdmin({ id: 1, role: ['super-admin'] })).toBe(false)
      expect(
        isTenantAdmin({
          id: 1,
          tenants: [{ tenant: 7, roles: ['user'] }],
        }),
      ).toBe(false)
    })
  })

  describe('isStaff', () => {
    it('returns true from tenants[n].roles', () => {
      expect(
        isStaff({
          id: 1,
          tenants: [{ tenant: 7, roles: ['staff'] }],
        }),
      ).toBe(true)
    })

    it('ignores derived/global role alone', () => {
      expect(isStaff({ id: 1, role: ['staff'] })).toBe(false)
    })

    it('returns false otherwise', () => {
      expect(isStaff({ id: 1, role: ['user'] })).toBe(false)
      expect(
        isStaff({
          id: 1,
          tenants: [{ tenant: 7, roles: ['admin'] }],
        }),
      ).toBe(false)
    })
  })

  describe('isStaffOnlyUser', () => {
    it('is true for staff without org admin', () => {
      expect(
        isStaffOnlyUser({
          id: 1,
          tenants: [{ tenant: 7, roles: ['staff'] }],
        }),
      ).toBe(true)
      expect(
        isStaffOnlyUser({
          id: 1,
          tenants: [{ tenant: 7, roles: ['staff', 'user'] }],
        }),
      ).toBe(true)
    })

    it('falls back to derived global role when tenants memberships are omitted', () => {
      expect(isStaffOnlyUser({ id: 1, role: ['staff'] })).toBe(true)
    })

    it('is false when org admin or super-admin', () => {
      expect(
        isStaffOnlyUser({
          id: 1,
          tenants: [{ tenant: 7, roles: ['admin'] }],
        }),
      ).toBe(false)
      expect(
        isStaffOnlyUser({
          id: 1,
          tenants: [{ tenant: 7, roles: ['admin', 'staff'] }],
        }),
      ).toBe(false)
      expect(isStaffOnlyUser({ id: 1, role: ['super-admin'] })).toBe(false)
      expect(isStaffOnlyUser({ id: 1, role: ['admin'] })).toBe(false)
    })

    it('does not treat pure location-manager as staff-only (use isPureLocationManager)', () => {
      const lm = {
        id: 1,
        tenants: [{ tenant: 7, roles: ['location-manager'] }],
      }
      expect(isStaffOnlyUser(lm)).toBe(false)
      expect(isPureLocationManager(lm)).toBe(true)
    })
  })

  describe('isTenantPortalUser', () => {
    it('includes org admin, staff, and location-manager memberships', () => {
      expect(
        isTenantPortalUser({ id: 1, tenants: [{ tenant: 7, roles: ['admin'] }] }),
      ).toBe(true)
      expect(
        isTenantPortalUser({ id: 1, tenants: [{ tenant: 7, roles: ['staff'] }] }),
      ).toBe(true)
      expect(
        isTenantPortalUser({
          id: 1,
          tenants: [{ tenant: 7, roles: ['location-manager'] }],
        }),
      ).toBe(true)
    })

    it('excludes regular members and derived global role alone', () => {
      expect(
        isTenantPortalUser({ id: 1, tenants: [{ tenant: 7, roles: ['user'] }] }),
      ).toBe(false)
      expect(isTenantPortalUser({ id: 1, role: ['location-manager'] })).toBe(false)
    })
  })

  describe('tenantOrgPayloadAdminAccess', () => {
    it('allows super-admin and org admin only', async () => {
      const superReq = { req: { user: { id: 1, role: ['super-admin'] } } }
      const adminReq = {
        req: { user: { id: 1, tenants: [{ tenant: 7, roles: ['admin'] }] } },
      }
      const staffReq = {
        req: { user: { id: 1, tenants: [{ tenant: 7, roles: ['staff'] }] } },
      }
      const globalAdminOnly = { req: { user: { id: 1, role: ['admin'] } } }
      const none = { req: { user: null } }

      expect(tenantOrgPayloadAdminAccess(superReq as any)).toBe(true)
      expect(tenantOrgPayloadAdminAccess(adminReq as any)).toBe(true)
      expect(tenantOrgPayloadAdminAccess(staffReq as any)).toBe(false)
      expect(tenantOrgPayloadAdminAccess(globalAdminOnly as any)).toBe(false)
      expect(tenantOrgPayloadAdminAccess(none as any)).toBe(false)
    })
  })
})

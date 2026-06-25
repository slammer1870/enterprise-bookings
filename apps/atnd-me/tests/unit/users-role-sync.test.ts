import { describe, it, expect } from 'vitest'
import {
  deriveRoleFromTenants,
  type TenantEntry,
} from '../../src/collections/Users/tenantHookHelpers'

describe('deriveRoleFromTenants', () => {
  it('derives admin when any tenant has admin role', () => {
    const tenants: TenantEntry[] = [
      { tenant: 1, roles: ['admin'] },
      { tenant: 2, roles: ['user'] },
    ]
    expect(deriveRoleFromTenants(tenants, ['user'])).toEqual(['admin'])
  })

  it('derives staff when highest role is staff', () => {
    const tenants: TenantEntry[] = [
      { tenant: 1, roles: ['staff'] },
      { tenant: 2, roles: ['user'] },
    ]
    expect(deriveRoleFromTenants(tenants, ['user'])).toEqual(['staff'])
  })

  it('derives location-manager when highest role is location-manager', () => {
    const tenants: TenantEntry[] = [
      { tenant: 1, roles: ['location-manager'] },
    ]
    expect(deriveRoleFromTenants(tenants, ['user'])).toEqual(['location-manager'])
  })

  it('derives user when only user roles exist', () => {
    const tenants: TenantEntry[] = [
      { tenant: 1, roles: ['user'] },
      { tenant: 2, roles: ['user'] },
    ]
    expect(deriveRoleFromTenants(tenants, ['admin'])).toEqual(['user'])
  })

  it('defaults to user when tenants array is empty', () => {
    expect(deriveRoleFromTenants([], ['admin'])).toEqual(['user'])
  })

  it('defaults to user when tenants have no roles', () => {
    const tenants: TenantEntry[] = [{ tenant: 1, roles: [] }]
    expect(deriveRoleFromTenants(tenants, ['admin'])).toEqual(['user'])
  })

  it('does not downgrade a super-admin — preserves existing roles unchanged', () => {
    const tenants: TenantEntry[] = [{ tenant: 1, roles: ['user'] }]
    const result = deriveRoleFromTenants(tenants, ['super-admin'])
    expect(result).toContain('super-admin')
  })

  it('does not downgrade even when tenants are empty for super-admin', () => {
    const result = deriveRoleFromTenants([], ['super-admin'])
    expect(result).toContain('super-admin')
  })

  it('uses highest priority: admin beats staff', () => {
    const tenants: TenantEntry[] = [
      { tenant: 1, roles: ['staff'] },
      { tenant: 2, roles: ['admin'] },
    ]
    expect(deriveRoleFromTenants(tenants, ['user'])).toEqual(['admin'])
  })

  it('uses highest priority: staff beats location-manager', () => {
    const tenants: TenantEntry[] = [
      { tenant: 1, roles: ['location-manager'] },
      { tenant: 2, roles: ['staff'] },
    ]
    expect(deriveRoleFromTenants(tenants, ['user'])).toEqual(['staff'])
  })
})

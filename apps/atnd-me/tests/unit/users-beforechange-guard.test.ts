import { describe, it, expect } from 'vitest'
import {
  mergeTenantEntriesForAdmin,
  type TenantEntry,
} from '../../src/collections/Users/tenantHookHelpers'

describe('mergeTenantEntriesForAdmin', () => {
  it('preserves own-tenant entries from incoming and restores foreign entries from DB', () => {
    const incoming: TenantEntry[] = [{ tenant: 1, roles: ['admin'] }]
    const dbTenants: TenantEntry[] = [
      { tenant: 1, roles: ['user'] },
      { tenant: 2, roles: ['staff'] }, // foreign — must be restored
    ]

    const result = mergeTenantEntriesForAdmin({
      incoming,
      adminTenantIds: [1],
      dbTenants,
    })

    const tenantIds = result.map((e) => {
      const t = e.tenant
      return typeof t === 'object' && t !== null && 'id' in t ? (t as { id: number }).id : t
    })

    expect(tenantIds).toContain(1)
    expect(tenantIds).toContain(2)

    // Tenant 1 entry comes from incoming (roles: ['admin'])
    const t1 = result.find((e) => e.tenant === 1)
    expect(t1?.roles).toContain('admin')

    // Tenant 2 entry comes from DB (roles: ['staff'])
    const t2 = result.find((e) => e.tenant === 2)
    expect(t2?.roles).toContain('staff')
  })

  it('strips foreign tenant entries injected via incoming (security guard)', () => {
    const incoming: TenantEntry[] = [
      { tenant: 1, roles: ['admin'] },
      { tenant: 2, roles: ['admin'] }, // foreign — admin trying to escalate
    ]
    const dbTenants: TenantEntry[] = [
      { tenant: 1, roles: ['user'] },
      // tenant 2 not in DB for this user
    ]

    const result = mergeTenantEntriesForAdmin({
      incoming,
      adminTenantIds: [1],
      dbTenants,
    })

    // Tenant 2 admin escalation stripped; tenant 2 not in DB so no preserved entry either
    const tenantIds = result.map((e) => e.tenant)
    expect(tenantIds).toContain(1)
    expect(tenantIds).not.toContain(2)
  })

  it('if admin tries to grant admin to foreign tenant already in DB, preserves DB roles not incoming', () => {
    const incoming: TenantEntry[] = [
      { tenant: 1, roles: ['admin'] },
      { tenant: 2, roles: ['admin'] }, // trying to escalate tenant2 to admin
    ]
    const dbTenants: TenantEntry[] = [
      { tenant: 1, roles: ['user'] },
      { tenant: 2, roles: ['user'] }, // foreign — DB has user, admin tries to set admin
    ]

    const result = mergeTenantEntriesForAdmin({
      incoming,
      adminTenantIds: [1],
      dbTenants,
    })

    const t2 = result.find((e) => e.tenant === 2)
    expect(t2?.roles).not.toContain('admin')
    expect(t2?.roles).toContain('user')
  })

  it('super-admin path: pass all incoming through unchanged (caller skips this function)', () => {
    const incoming: TenantEntry[] = [{ tenant: 99, roles: ['admin'] }]
    // When adminTenantIds covers all, nothing is filtered
    const result = mergeTenantEntriesForAdmin({
      incoming,
      adminTenantIds: [99],
      dbTenants: [],
    })
    expect(result).toEqual(incoming)
  })

  it('handles populated tenant objects in both incoming and DB', () => {
    const incoming: TenantEntry[] = [{ tenant: { id: 1 }, roles: ['admin'] }]
    const dbTenants: TenantEntry[] = [
      { tenant: { id: 1 }, roles: ['user'] },
      { tenant: { id: 2 }, roles: ['staff'] },
    ]

    const result = mergeTenantEntriesForAdmin({
      incoming,
      adminTenantIds: [1],
      dbTenants,
    })

    expect(result).toHaveLength(2)
    // Foreign tenant 2 preserved
    const t2 = result.find((e) => {
      const t = e.tenant
      return typeof t === 'object' && t !== null && 'id' in t && (t as { id: number }).id === 2
    })
    expect(t2).toBeDefined()
    expect(t2?.roles).toContain('staff')
  })

  it('does not mutate input arrays', () => {
    const incoming: TenantEntry[] = [{ tenant: 1, roles: ['admin'] }]
    const dbTenants: TenantEntry[] = [{ tenant: 2, roles: ['staff'] }]

    mergeTenantEntriesForAdmin({ incoming, adminTenantIds: [1], dbTenants })

    expect(incoming).toHaveLength(1)
    expect(dbTenants).toHaveLength(1)
  })
})

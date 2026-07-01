import { describe, it, expect } from 'vitest'
import {
  filterTenantsForTenantAdmin,
} from '../../src/collections/Users/tenantHookHelpers'

describe('filterTenantsForTenantAdmin', () => {
  it('super-admin receives all tenants entries unfiltered (caller skips this function)', () => {
    const doc = {
      tenants: [{ tenant: 1, roles: ['admin'] }, { tenant: 2, roles: ['user'] }],
      registrationTenant: 2,
    }
    // When admin controls [1, 2], nothing is filtered out
    const result = filterTenantsForTenantAdmin({ doc, adminTenantIds: [1, 2] })
    expect(result.tenants).toHaveLength(2)
    expect(result.registrationTenant).toBe(2)
  })

  it('tenant admin only sees own-tenant entries', () => {
    const doc = {
      tenants: [{ tenant: 1, roles: ['admin'] }, { tenant: 2, roles: ['user'] }],
      registrationTenant: 1,
    }
    // Admin controls only tenant 1
    const result = filterTenantsForTenantAdmin({ doc, adminTenantIds: [1] })
    expect(result.tenants).toHaveLength(1)
    expect((result.tenants as Array<{ tenant: unknown }>)[0]!.tenant).toBe(1)
  })

  it('tenant admin: registrationTenant nulled when pointing to a foreign tenant', () => {
    const doc = {
      tenants: [{ tenant: 1, roles: ['admin'] }],
      registrationTenant: 2,
    }
    const result = filterTenantsForTenantAdmin({ doc, adminTenantIds: [1] })
    expect(result.registrationTenant).toBeNull()
  })

  it('tenant admin: registrationTenant kept when pointing to own tenant', () => {
    const doc = {
      tenants: [{ tenant: 1, roles: ['admin'] }],
      registrationTenant: 1,
    }
    const result = filterTenantsForTenantAdmin({ doc, adminTenantIds: [1] })
    expect(result.registrationTenant).toBe(1)
  })

  it('works with populated tenant objects ({ id } shape)', () => {
    const doc = {
      tenants: [
        { tenant: { id: 1, slug: 'tenant-1' }, roles: ['admin'] },
        { tenant: { id: 2, slug: 'tenant-2' }, roles: ['user'] },
      ],
      registrationTenant: { id: 2 },
    }
    const result = filterTenantsForTenantAdmin({ doc, adminTenantIds: [1] })
    expect(result.tenants).toHaveLength(1)
    expect(result.registrationTenant).toBeNull()
  })

  it('leaves doc unchanged when adminTenantIds covers all tenants', () => {
    const doc = {
      tenants: [{ tenant: 1, roles: ['admin'] }, { tenant: 3, roles: ['staff'] }],
      registrationTenant: 3,
    }
    const result = filterTenantsForTenantAdmin({ doc, adminTenantIds: [1, 2, 3] })
    expect(result.tenants).toHaveLength(2)
    expect(result.registrationTenant).toBe(3)
  })

  it('returns empty tenants array when admin controls no matching tenants', () => {
    const doc = {
      tenants: [{ tenant: 5, roles: ['user'] }],
      registrationTenant: 5,
    }
    const result = filterTenantsForTenantAdmin({ doc, adminTenantIds: [1] })
    expect(result.tenants).toHaveLength(0)
    expect(result.registrationTenant).toBeNull()
  })

  it('does not mutate the original doc', () => {
    const tenants = [{ tenant: 1, roles: ['admin'] }, { tenant: 2, roles: ['user'] }]
    const doc = { tenants, registrationTenant: 2 }
    filterTenantsForTenantAdmin({ doc, adminTenantIds: [1] })
    expect(doc.tenants).toHaveLength(2) // original unchanged
  })
})

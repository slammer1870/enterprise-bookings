import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveOrgAdminTenantIds = vi.hoisted(() => vi.fn())
const getTenantMembershipIdsFromUserDoc = vi.hoisted(() => vi.fn())
const loadUserDocForTenantMembership = vi.hoisted(() => vi.fn())

vi.mock('@/access/tenant-scoped', () => ({
  resolveOrgAdminTenantIds,
  getTenantMembershipIdsFromUserDoc,
  loadUserDocForTenantMembership,
}))

vi.mock('@/access/userTenantAccess', () => ({
  isAdmin: (user: unknown) => {
    const role = (user as { role?: string | string[] } | null)?.role
    if (Array.isArray(role)) return role.includes('super-admin')
    return role === 'super-admin'
  },
}))

import { usersTenantsTenantFilterOptions } from '@/collections/Users/tenantsTenantFilterOptions'

describe('usersTenantsTenantFilterOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows all tenants for super-admins', async () => {
    const result = await usersTenantsTenantFilterOptions({
      req: {
        user: { id: 1, role: ['super-admin'] },
        payload: {},
        context: {},
      } as any,
    })
    expect(result).toBe(true)
    expect(resolveOrgAdminTenantIds).not.toHaveBeenCalled()
  })

  it('scopes org admins to tenants they administer (not every membership)', async () => {
    resolveOrgAdminTenantIds.mockResolvedValue([10])

    const result = await usersTenantsTenantFilterOptions({
      req: {
        user: {
          id: 2,
          role: ['admin'],
          tenants: [
            { tenant: 10, roles: ['admin'] },
            { tenant: 20, roles: ['user'] },
          ],
        },
        payload: {},
        context: {},
      } as any,
    })

    expect(result).toEqual({ id: { in: [10] } })
    expect(getTenantMembershipIdsFromUserDoc).not.toHaveBeenCalled()
  })

  it('does not return true for org admins (prevents foreign tenant assignment)', async () => {
    resolveOrgAdminTenantIds.mockResolvedValue([10])

    const result = await usersTenantsTenantFilterOptions({
      req: {
        user: {
          id: 3,
          role: ['user'],
          tenants: [{ tenant: 10, roles: ['admin'] }],
        },
        payload: {},
        context: {},
      } as any,
    })

    expect(result).not.toBe(true)
    expect(result).toEqual({ id: { in: [10] } })
  })
})

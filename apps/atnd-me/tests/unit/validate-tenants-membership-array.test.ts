import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveOrgAdminTenantIds = vi.hoisted(() => vi.fn())

vi.mock('@/access/tenant-scoped', () => ({
  resolveOrgAdminTenantIds,
}))

vi.mock('@/access/userTenantAccess', () => ({
  isAdmin: (user: unknown) => {
    const role = (user as { role?: string | string[] } | null)?.role
    if (Array.isArray(role)) return role.includes('super-admin')
    return role === 'super-admin'
  },
}))

import { validateTenantsMembershipArray } from '@/collections/Users/validateTenantsMembershipArray'

describe('validateTenantsMembershipArray', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects duplicate tenants for super-admins', async () => {
    const result = await validateTenantsMembershipArray(
      [{ tenant: 1 }, { tenant: 1 }],
      { req: { user: { role: ['super-admin'] }, payload: {}, context: {} } as any },
    )
    expect(result).toBe('Each tenant may only be added once.')
  })

  it('allows super-admins any number of tenants', async () => {
    const result = await validateTenantsMembershipArray(
      [{ tenant: 1 }, { tenant: 2 }, { tenant: 3 }],
      { req: { user: { role: ['super-admin'] }, payload: {}, context: {} } as any },
    )
    expect(result).toBe(true)
    expect(resolveOrgAdminTenantIds).not.toHaveBeenCalled()
  })

  it('rejects more editable rows than the org admin administers', async () => {
    resolveOrgAdminTenantIds.mockResolvedValue([10])

    const result = await validateTenantsMembershipArray(
      [{ tenant: 10 }, { tenant: null }],
      {
        req: {
          user: { id: 1, role: ['admin'], tenants: [{ tenant: 10, roles: ['admin'] }] },
          payload: {},
          context: {},
        } as any,
      },
    )

    expect(result).toMatch(/up to 1 tenant/)
  })

  it('ignores foreign rows re-merged from DB when applying the cap', async () => {
    resolveOrgAdminTenantIds.mockResolvedValue([10])

    const result = await validateTenantsMembershipArray(
      [
        { tenant: 10, roles: ['staff'] },
        { tenant: 20, roles: ['user'] }, // foreign — preserved by beforeChange merge
      ],
      {
        req: {
          user: { id: 1, role: ['admin'], tenants: [{ tenant: 10, roles: ['admin'] }] },
          payload: {},
          context: {},
        } as any,
      },
    )

    expect(result).toBe(true)
  })

  it('allows assigning exactly the admin’s own tenants', async () => {
    resolveOrgAdminTenantIds.mockResolvedValue([10, 20])

    const result = await validateTenantsMembershipArray(
      [{ tenant: 10 }, { tenant: 20 }],
      {
        req: {
          user: {
            id: 1,
            role: ['admin'],
            tenants: [
              { tenant: 10, roles: ['admin'] },
              { tenant: 20, roles: ['admin'] },
            ],
          },
          payload: {},
          context: {},
        } as any,
      },
    )

    expect(result).toBe(true)
  })
})

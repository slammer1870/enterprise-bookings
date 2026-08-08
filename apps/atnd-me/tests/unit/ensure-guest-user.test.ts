/**
 * ensureGuestUser must always write tenants[n].roles so Payload required validation passes
 * (guest checkout Local API has no req.user; roles stripping previously 400'd the route).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { ensureGuestUser } from '@/lib/booking/ensureGuestUser'

const mockPayload = {
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

describe('ensureGuestUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a user with tenants[n].roles = ["user"]', async () => {
    mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })
    mockPayload.create.mockResolvedValue({ id: 42 })

    const result = await ensureGuestUser({
      payload: mockPayload as never,
      name: 'Guest Buyer',
      email: 'guest@example.com',
      tenantId: 7,
    })

    expect(result).toEqual({
      userId: 42,
      created: true,
      email: 'guest@example.com',
      name: 'Guest Buyer',
    })
    expect(mockPayload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        overrideAccess: true,
        context: expect.objectContaining({
          __atndSystemUserWrite: true,
          __atndSystemUserWriteAllowedRoles: ['user'],
        }),
        data: expect.objectContaining({
          email: 'guest@example.com',
          registrationTenant: 7,
          role: ['user'],
          tenants: [{ tenant: 7, roles: ['user'] }],
        }),
      }),
    )
  })

  it('appends a tenant membership with roles when the user exists elsewhere', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 9,
          name: 'Existing',
          tenants: [{ id: 'row-1', tenant: 3, roles: ['user'] }],
        },
      ],
      totalDocs: 1,
    })
    mockPayload.update.mockResolvedValue({ id: 9 })

    const result = await ensureGuestUser({
      payload: mockPayload as never,
      name: 'Existing',
      email: 'existing@example.com',
      tenantId: 7,
    })

    expect(result.created).toBe(false)
    expect(result.userId).toBe(9)
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 9,
        overrideAccess: true,
        context: expect.objectContaining({
          __atndSystemUserWrite: true,
          __atndSystemUserWriteAllowedRoles: ['user', 'admin', 'staff', 'location-manager'],
        }),
        data: {
          registrationTenant: 7,
          tenants: [
            { id: 'row-1', tenant: 3, roles: ['user'] },
            { tenant: 7, roles: ['user'] },
          ],
        },
      }),
    )
  })

  it('normalizes missing/invalid roles to ["user"] when rewriting memberships', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 11,
          name: 'No Roles',
          tenants: [
            { tenant: 1, roles: null },
            { tenant: 2, roles: [{ value: 'admin' }, 'nope'] },
          ],
        },
      ],
      totalDocs: 1,
    })
    mockPayload.update.mockResolvedValue({ id: 11 })

    await ensureGuestUser({
      payload: mockPayload as never,
      name: 'No Roles',
      email: 'noroles@example.com',
      tenantId: 7,
    })

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          registrationTenant: 7,
          tenants: [
            { tenant: 1, roles: ['user'] },
            { tenant: 2, roles: ['admin'] },
            { tenant: 7, roles: ['user'] },
          ],
        },
      }),
    )
  })

  it('appends checkout tenant for a tenant-admin of another tenant without dropping admin roles', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 20,
          name: 'Other Tenant Admin',
          tenants: [{ id: 'row-admin', tenant: 3, roles: ['admin'] }],
        },
      ],
      totalDocs: 1,
    })
    mockPayload.update.mockResolvedValue({ id: 20 })

    const result = await ensureGuestUser({
      payload: mockPayload as never,
      name: 'Other Tenant Admin',
      email: 'admin-elsewhere@example.com',
      tenantId: 7,
    })

    expect(result.created).toBe(false)
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          registrationTenant: 7,
          tenants: [
            { id: 'row-admin', tenant: 3, roles: ['admin'] },
            { tenant: 7, roles: ['user'] },
          ],
        },
        context: expect.objectContaining({
          __atndSystemUserWriteAllowedRoles: ['user', 'admin', 'staff', 'location-manager'],
        }),
      }),
    )
  })

  it('repairs empty/duplicate roles even when checkout tenant membership already exists', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 15,
          name: 'Broken Roles',
          registrationTenant: 7,
          tenants: [
            { id: 'row-a', tenant: 7, roles: [] },
            { id: 'row-b', tenant: 3, roles: ['user', 'user'] },
          ],
        },
      ],
      totalDocs: 1,
    })
    mockPayload.update.mockResolvedValue({ id: 15 })

    await ensureGuestUser({
      payload: mockPayload as never,
      name: 'Broken Roles',
      email: 'broken@example.com',
      tenantId: 7,
    })

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenants: [
            { id: 'row-a', tenant: 7, roles: ['user'] },
            { id: 'row-b', tenant: 3, roles: ['user'] },
          ],
        },
      }),
    )
  })

  it('does not rewrite tenants when membership and registrationTenant already exist', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 12,
          name: 'Member',
          registrationTenant: 7,
          tenants: [{ tenant: 7, roles: ['user'] }],
        },
      ],
      totalDocs: 1,
    })

    await ensureGuestUser({
      payload: mockPayload as never,
      name: 'Member',
      email: 'member@example.com',
      tenantId: 7,
    })

    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('backfills registrationTenant when an existing user is missing it', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 13,
          name: 'No Reg Tenant',
          registrationTenant: null,
          tenants: [{ tenant: 7, roles: ['user'] }],
        },
      ],
      totalDocs: 1,
    })
    mockPayload.update.mockResolvedValue({ id: 13 })

    await ensureGuestUser({
      payload: mockPayload as never,
      name: 'No Reg Tenant',
      email: 'noreg@example.com',
      tenantId: 7,
    })

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 13,
        data: { registrationTenant: 7 },
      }),
    )
  })

  it('rejects invalid email / empty name', async () => {
    await expect(
      ensureGuestUser({
        payload: mockPayload as never,
        name: 'X',
        email: 'not-an-email',
        tenantId: 1,
      }),
    ).rejects.toThrow(/email/i)

    await expect(
      ensureGuestUser({
        payload: mockPayload as never,
        name: 'Sam',
        email: 'sam@',
        tenantId: 1,
      }),
    ).rejects.toThrow(/email/i)

    await expect(
      ensureGuestUser({
        payload: mockPayload as never,
        name: '   ',
        email: 'ok@example.com',
        tenantId: 1,
      }),
    ).rejects.toThrow(/name/i)
  })

  it('recovers when create races on unique email', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 77,
            name: 'Winner',
            registrationTenant: 7,
            tenants: [{ tenant: 7, roles: ['user'] }],
          },
        ],
        totalDocs: 1,
      })
    mockPayload.create.mockRejectedValue(
      new Error('The following field is invalid: email'),
    )

    const result = await ensureGuestUser({
      payload: mockPayload as never,
      name: 'Winner',
      email: 'race@example.com',
      tenantId: 7,
    })

    expect(result).toEqual({
      userId: 77,
      created: false,
      email: 'race@example.com',
      name: 'Winner',
    })
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('backfills registrationTenant when create races and winner lacks it', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [], totalDocs: 0 })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 78,
            name: 'Winner',
            registrationTenant: null,
            tenants: [{ tenant: 7, roles: ['user'] }],
          },
        ],
        totalDocs: 1,
      })
    mockPayload.create.mockRejectedValue(
      new Error('The following field is invalid: email'),
    )
    mockPayload.update.mockResolvedValue({ id: 78 })

    await ensureGuestUser({
      payload: mockPayload as never,
      name: 'Winner',
      email: 'race-noreg@example.com',
      tenantId: 7,
    })

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 78,
        data: { registrationTenant: 7 },
      }),
    )
  })
})

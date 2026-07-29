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
          tenants: [
            { tenant: 1, roles: ['user'] },
            { tenant: 2, roles: ['admin'] },
            { tenant: 7, roles: ['user'] },
          ],
        },
      }),
    )
  })

  it('does not rewrite tenants when membership already exists', async () => {
    mockPayload.find.mockResolvedValue({
      docs: [
        {
          id: 12,
          name: 'Member',
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
})

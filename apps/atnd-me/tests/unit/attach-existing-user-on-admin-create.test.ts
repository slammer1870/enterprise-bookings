import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIError, ValidationError } from 'payload'

vi.mock('@/collections/Users/ensureCreateTenantScope', () => ({
  resolveTenantIdForUserCreate: vi.fn(),
}))

vi.mock('../../src/access/tenant-scoped', async () => {
  const actual = await vi.importActual<typeof import('../../src/access/tenant-scoped')>(
    '../../src/access/tenant-scoped',
  )
  return {
    ...actual,
    resolveOrgAdminTenantIds: vi.fn(async () => [7]),
  }
})

import { attachExistingUserOnAdminCreate } from '../../src/collections/Users/attachExistingUserOnAdminCreate'
import { resolveTenantIdForUserCreate } from '@/collections/Users/ensureCreateTenantScope'
import { resolveOrgAdminTenantIds } from '../../src/access/tenant-scoped'

describe('attachExistingUserOnAdminCreate', () => {
  const update = vi.fn(async () => ({ id: 9 }))
  const find = vi.fn()
  const findByID = vi.fn(async () => {
    const settled = find.mock.results.at(-1)
    const value = settled ? await settled.value : null
    return value?.docs?.[0] ?? null
  })

  beforeEach(() => {
    update.mockClear()
    find.mockReset()
    findByID.mockClear()
    vi.mocked(resolveTenantIdForUserCreate).mockReset()
    vi.mocked(resolveOrgAdminTenantIds).mockReset()
    vi.mocked(resolveOrgAdminTenantIds).mockResolvedValue([7])
    vi.mocked(resolveTenantIdForUserCreate).mockResolvedValue(7)
  })

  function req(user: unknown) {
    return {
      user,
      payload: { find, findByID, update },
      context: {},
    } as never
  }

  it('no-ops when email is new (create should proceed)', async () => {
    find.mockResolvedValue({ docs: [] })

    await attachExistingUserOnAdminCreate({
      data: { email: 'new@example.com', name: 'New' },
      req: req({ id: 1, tenants: [{ tenant: 7, roles: ['admin'] }] }),
    })

    expect(update).not.toHaveBeenCalled()
  })

  it('attaches cross-tenant user then throws so create does not insert a duplicate', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 9,
          name: 'Existing',
          email: 'existing@example.com',
          registrationTenant: 3,
          tenants: [{ id: 'row-1', tenant: 3, roles: ['user'] }],
        },
      ],
    })

    await expect(
      attachExistingUserOnAdminCreate({
        data: { email: 'existing@example.com', name: 'Existing' },
        req: req({ id: 1, tenants: [{ tenant: 7, roles: ['admin'] }] }),
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ req: expect.anything(), overrideAccess: true }))
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 9,
        overrideAccess: true,
        data: expect.objectContaining({
          tenants: [
            { id: 'row-1', tenant: 3, roles: ['user'] },
            { tenant: 7, roles: ['user'] },
          ],
        }),
      }),
    )
    // Must not join the create transaction. The ValidationError would roll the membership back.
    expect(update.mock.calls[0]![0].req).toBeUndefined()
    // Must not overwrite original registration tenant
    const data = update.mock.calls[0]![0].data as Record<string, unknown>
    expect(data.registrationTenant).toBeUndefined()
    expect(data.name).toBeUndefined()
  })

  it('does not attach when user is already a member — validation only', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 9,
          registrationTenant: 7,
          tenants: [{ tenant: 7, roles: ['user'] }],
        },
      ],
    })

    await expect(
      attachExistingUserOnAdminCreate({
        data: { email: 'same@example.com' },
        req: req({ id: 1, tenants: [{ tenant: 7, roles: ['admin'] }] }),
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(update).not.toHaveBeenCalled()
  })

  it('ignores anonymous creates (Better Auth / public signup)', async () => {
    find.mockResolvedValue({
      docs: [{ id: 9, tenants: [{ tenant: 3, roles: ['user'] }] }],
    })

    await attachExistingUserOnAdminCreate({
      data: { email: 'existing@example.com' },
      req: req(null),
    })

    expect(find).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('refuses a location-manager attach to a tenant they do not belong to', async () => {
    vi.mocked(resolveOrgAdminTenantIds).mockResolvedValue([])
    vi.mocked(resolveTenantIdForUserCreate).mockResolvedValue(9)
    find.mockResolvedValue({
      docs: [{ id: 9, tenants: [{ tenant: 3, roles: ['user'] }] }],
    })

    await expect(
      attachExistingUserOnAdminCreate({
        data: { email: 'existing@example.com', tenants: [{ tenant: 9, roles: ['admin'] }] },
        req: req({ id: 4, tenants: [{ tenant: 7, roles: ['location-manager'] }] }),
      }),
    ).rejects.toBeInstanceOf(APIError)

    expect(update).not.toHaveBeenCalled()
  })

  it('attaches a location-manager create as a plain user on their own tenant', async () => {
    vi.mocked(resolveOrgAdminTenantIds).mockResolvedValue([])
    vi.mocked(resolveTenantIdForUserCreate).mockResolvedValue(7)
    find.mockResolvedValue({
      docs: [{ id: 9, tenants: [{ tenant: 3, roles: ['user'] }] }],
    })

    await expect(
      attachExistingUserOnAdminCreate({
        data: {
          email: 'existing@example.com',
          tenants: [{ tenant: 7, roles: ['admin'] }],
        },
        req: req({ id: 4, tenants: [{ tenant: 7, roles: ['location-manager'] }] }),
      }),
    ).rejects.toBeInstanceOf(ValidationError)

    const data = update.mock.calls[0]![0].data as { tenants: Array<{ tenant: number; roles: string[] }> }
    expect(data.tenants).toEqual([
      { tenant: 3, roles: ['user'] },
      { tenant: 7, roles: ['user'] },
    ])
  })
})

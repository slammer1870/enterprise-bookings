import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  attachUserToTenant,
  rolesForTenantFromCreateData,
} from '../../src/lib/users/attachUserToTenant'

describe('attachUserToTenant', () => {
  const update = vi.fn(async () => ({ id: 9 }))

  beforeEach(() => {
    update.mockClear()
  })

  it('appends membership for a new tenant without moving registrationTenant', async () => {
    const result = await attachUserToTenant({
      payload: { update } as never,
      doc: {
        id: 9,
        name: 'Existing',
        registrationTenant: 3,
        tenants: [{ id: 'row-1', tenant: 3, roles: ['user'] }],
      },
      tenantId: 7,
      roles: ['user'],
    })

    expect(result).toEqual({ userId: 9, attached: true, alreadyMember: false })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        data: {
          tenants: [
            { id: 'row-1', tenant: 3, roles: ['user'] },
            { tenant: 7, roles: ['user'] },
          ],
        },
      }),
    )
  })

  it('no-ops when already a member with valid roles', async () => {
    const result = await attachUserToTenant({
      payload: { update } as never,
      doc: {
        id: 9,
        registrationTenant: 7,
        tenants: [{ tenant: 7, roles: ['user'] }],
      },
      tenantId: 7,
    })

    expect(result).toEqual({ userId: 9, attached: false, alreadyMember: true })
    expect(update).not.toHaveBeenCalled()
  })

  it('appends a membership when registrationTenant is missing and does not set one', async () => {
    await attachUserToTenant({
      payload: { update } as never,
      doc: { id: 9, tenants: [] },
      tenantId: 7,
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenants: [{ tenant: 7, roles: ['user'] }],
        },
      }),
    )
  })
})

describe('rolesForTenantFromCreateData', () => {
  it('reads roles for the matching tenant row', () => {
    expect(
      rolesForTenantFromCreateData(
        { tenants: [{ tenant: 7, roles: ['staff'] }, { tenant: 3, roles: ['user'] }] },
        7,
      ),
    ).toEqual(['staff'])
  })

  it('defaults to user when no matching row', () => {
    expect(rolesForTenantFromCreateData({ tenants: [{ tenant: 3, roles: ['admin'] }] }, 7)).toEqual([
      'user',
    ])
  })
})

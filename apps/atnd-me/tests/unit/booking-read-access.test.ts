import { beforeEach, describe, expect, it } from 'vitest'

import { bookingReadAccess } from '@/access/bookingReadAccess'
import { clearTenantAdminTenantIdsTtlCache } from '@/access/tenant-scoped'

function makeReq(user: { id: number; role?: string[]; tenants?: unknown[] }) {
  return {
    user: { ...user, collection: 'users' },
    payload: {
      findByID: async () => null,
    },
    context: {},
  }
}

describe('bookingReadAccess', () => {
  beforeEach(() => {
    clearTenantAdminTenantIdsTtlCache()
  })

  it('hides pending bookings from staff-only users in their tenants', async () => {
    const result = await bookingReadAccess({
      req: makeReq({
        id: 3,
        role: ['staff'],
        tenants: [{ tenant: 42, roles: ['staff'] }],
      }) as never,
    } as never)

    expect(result).toEqual({
      and: [{ tenant: { in: [42] } }, { status: { not_equals: 'pending' } }],
    })
  })

  it('lets org admins read pending bookings in their tenants', async () => {
    const result = await bookingReadAccess({
      req: makeReq({
        id: 4,
        role: ['admin'],
        tenants: [{ tenant: 42, roles: ['admin', 'staff'] }],
      }) as never,
    } as never)

    expect(result).toEqual({ tenant: { in: [42] } })
  })

  it('hides pending bookings only on tenants where the user is staff', async () => {
    const result = await bookingReadAccess({
      req: makeReq({
        id: 6,
        role: ['admin'],
        tenants: [
          { tenant: 7, roles: ['staff'] },
          { tenant: 9, roles: ['admin'] },
        ],
      }) as never,
    } as never)

    expect(result).toEqual({
      or: [
        {
          and: [{ tenant: { in: [7] } }, { status: { not_equals: 'pending' } }],
        },
        { tenant: { in: [9] } },
      ],
    })
  })

  it('reads memberships when the session user omits tenants', async () => {
    const result = await bookingReadAccess({
      req: {
        user: { id: 8, role: ['admin'], collection: 'users' },
        payload: {
          findByID: async () => ({
            id: 8,
            role: ['admin'],
            tenants: [
              { tenant: 7, roles: ['staff'] },
              { tenant: 9, roles: ['admin'] },
            ],
          }),
        },
        context: {},
      } as never,
    } as never)

    expect(result).toEqual({
      or: [
        {
          and: [{ tenant: { in: [7] } }, { status: { not_equals: 'pending' } }],
        },
        { tenant: { in: [9] } },
      ],
    })
  })

  it('lets a customer read their own bookings, including pending', async () => {
    const result = await bookingReadAccess({
      req: makeReq({ id: 5, role: ['user'] }) as never,
    } as never)

    expect(result).toEqual({ user: { equals: 5 } })
  })
})

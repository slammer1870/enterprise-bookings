/**
 * Regression: super-admin booking updates from the custom timeslots admin view
 * (EditBooking PATCH /api/bookings/:id) must not return false when the user also
 * has org `admin` role — resolveTenantAdminTenantIds returns [] for super-admins.
 */
import { describe, it, expect } from 'vitest'
import { bookingUpdateAccessWithPaymentValidation } from '@/access/bookingAccess'

function makeReq(user: { id: number; role: string[] }) {
  return {
    user: { ...user, collection: 'users' },
    payload: {
      findByID: async () => null,
    },
    context: {},
  }
}

describe('bookingUpdateAccessWithPaymentValidation', () => {
  it('allows platform super-admin to update any booking', async () => {
    const result = await bookingUpdateAccessWithPaymentValidation({
      req: makeReq({ id: 1, role: ['super-admin'] }) as never,
      id: 99,
      data: { status: 'confirmed' },
    } as never)

    expect(result).toBe(true)
  })

  it('allows super-admin even when they also have org admin role', async () => {
    const result = await bookingUpdateAccessWithPaymentValidation({
      req: makeReq({ id: 1, role: ['super-admin', 'admin'] }) as never,
      id: 99,
      data: { status: 'cancelled' },
    } as never)

    expect(result).toBe(true)
  })

  it('scopes org admin updates to assigned tenants', async () => {
    const result = await bookingUpdateAccessWithPaymentValidation({
      req: makeReq({ id: 2, role: ['admin'], tenants: [{ tenant: 42 }] }) as never,
      id: 99,
      data: { status: 'confirmed' },
    } as never)

    expect(result).toEqual({ tenant: { in: [42] } })
  })
})

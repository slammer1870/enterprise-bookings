import { describe, expect, it, vi } from 'vitest'

import { createBookingTransactionOnCreate } from '@repo/bookings-payments'

describe('createBookingTransactionOnCreate', () => {
  it('stores the timeslot location on the new booking transaction', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const findByID = vi.fn().mockResolvedValue({ id: 9, branch: 42 })
    const hook = createBookingTransactionOnCreate()

    await hook({
      doc: {
        id: 3,
        paymentMethodUsed: 'class_pass',
        classPassIdUsed: 8,
        timeslot: 9,
        tenant: 2,
      },
      operation: 'create',
      req: { payload: { create, findByID }, context: {} },
    } as never)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'transactions',
        data: expect.objectContaining({
          booking: 3,
          paymentMethod: 'class_pass',
          branch: 42,
        }),
      }),
    )
  })

  it('leaves the branch empty when the timeslot has no location', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const findByID = vi.fn().mockResolvedValue({ id: 9, branch: null })
    const hook = createBookingTransactionOnCreate()

    await hook({
      doc: {
        id: 3,
        paymentMethodUsed: 'subscription',
        subscriptionIdUsed: 11,
        timeslot: 9,
        tenant: 2,
      },
      operation: 'create',
      req: { payload: { create, findByID }, context: {} },
    } as never)

    const data = create.mock.calls[0]?.[0]?.data as { branch?: unknown }
    expect(data.branch).toBeUndefined()
    expect(data.paymentMethod).toBe('subscription')
  })
})

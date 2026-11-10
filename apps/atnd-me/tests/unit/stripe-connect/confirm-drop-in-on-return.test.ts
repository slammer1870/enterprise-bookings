import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const retrieve = vi.fn()
const refundsCreate = vi.fn()

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    paymentIntents: { retrieve },
    refunds: { create: refundsCreate },
  }),
}))

vi.mock('@repo/bookings-payments', () => ({
  fulfillCheckoutHold: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/classBranchLedgerCents', () => ({
  classBranchLedgerCentsForCode: vi.fn(async ({ cashCents }: { cashCents: number }) => cashCents),
}))

import { fulfillCheckoutHold } from '@repo/bookings-payments'
import { confirmDropInPaymentOnReturn } from '@/lib/stripe-connect/confirm-drop-in-on-return'

const fulfill = vi.mocked(fulfillCheckoutHold)

function paymentIntent(overrides?: Record<string, string>) {
  return {
    id: 'pi_dropin',
    status: 'succeeded',
    amount: 1500,
    application_fee_amount: 0,
    metadata: {
      userId: '5',
      holdId: '50',
      timeslotId: '10',
      dropInId: '3',
      classPriceAmountCents: '1500',
      ...overrides,
    },
  }
}

describe('confirmDropInPaymentOnReturn', () => {
  beforeEach(() => {
    retrieve.mockReset()
    fulfill.mockReset()
    refundsCreate.mockReset()
  })

  it('fulfills the checkout hold before returning so the schedule can see the booking', async () => {
    retrieve.mockResolvedValue(paymentIntent())
    fulfill.mockResolvedValue({ confirmedBookingIds: [99], refunded: false })
    const payload = { find: vi.fn(), logger: { error: vi.fn() } }

    await expect(
      confirmDropInPaymentOnReturn({
        payload: payload as never,
        userId: 5,
        paymentIntentId: 'pi_dropin',
        tenantId: 3,
        stripeAccountId: 'acct_live',
      }),
    ).resolves.toBe(true)

    expect(fulfill).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        holdId: 50,
        userId: 5,
        paymentIntentId: 'pi_dropin',
        tenantId: 3,
        dropInId: 3,
        classPriceAmountCents: 1500,
      }),
    )
    expect(payload.find).not.toHaveBeenCalled()
  })

  it('does not fulfill a payment that belongs to someone else', async () => {
    retrieve.mockResolvedValue(paymentIntent({ userId: '8' }))
    const payload = { find: vi.fn() }

    await expect(
      confirmDropInPaymentOnReturn({
        payload: payload as never,
        userId: 5,
        paymentIntentId: 'pi_dropin',
        tenantId: 3,
      }),
    ).resolves.toBe(false)

    expect(fulfill).not.toHaveBeenCalled()
  })

  it('still fulfills when the first payment lookups miss', async () => {
    retrieve
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(paymentIntent())
    fulfill.mockResolvedValue({ confirmedBookingIds: [99], refunded: false })
    const payload = { find: vi.fn(), logger: { error: vi.fn() } }

    await expect(
      confirmDropInPaymentOnReturn({
        payload: payload as never,
        userId: 5,
        paymentIntentId: 'pi_dropin',
        tenantId: 3,
      }),
    ).resolves.toBe(true)

    expect(fulfill).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ holdId: 50, paymentIntentId: 'pi_dropin' }),
    )
  })

  it('waits until the confirmed booking exists when fulfillment lost the race', async () => {
    retrieve.mockResolvedValue(paymentIntent())
    fulfill.mockResolvedValue({ confirmedBookingIds: [], refunded: false })
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 99 }] }),
    }

    await expect(
      confirmDropInPaymentOnReturn({
        payload: payload as never,
        userId: 5,
        paymentIntentId: 'pi_dropin',
        tenantId: 3,
      }),
    ).resolves.toBe(true)

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        where: {
          and: [
            { timeslot: { equals: 10 } },
            { user: { equals: 5 } },
            { status: { equals: 'confirmed' } },
          ],
        },
      }),
    )
  })
})

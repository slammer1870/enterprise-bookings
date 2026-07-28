import { beforeEach, describe, expect, it, vi } from 'vitest'

const paymentIntentsCreate = vi.fn()
const calculateBookingFeeAmount = vi.fn()

vi.mock('@/lib/stripe/platform', () => ({
  getPlatformStripe: () => ({
    paymentIntents: { create: paymentIntentsCreate },
  }),
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: () => false,
}))

vi.mock('@/lib/stripe-connect/bookingFee', () => ({
  calculateBookingFeeAmount: (...args: unknown[]) => calculateBookingFeeAmount(...args),
}))

const payload = {} as never

describe('createGiftVoucherPaymentIntent', () => {
  beforeEach(() => {
    paymentIntentsCreate.mockReset()
    calculateBookingFeeAmount.mockReset()
    calculateBookingFeeAmount.mockResolvedValue(150)
    paymentIntentsCreate.mockResolvedValue({
      id: 'pi_guest_1',
      client_secret: 'pi_guest_1_secret',
    })
  })

  it('creates a Connect direct charge for guests with platform application fee', async () => {
    const { createGiftVoucherPaymentIntent } = await import(
      '@/lib/stripe-connect/createGiftVoucherPaymentIntent'
    )

    const result = await createGiftVoucherPaymentIntent({
      tenant: {
        id: 11,
        stripeConnectAccountId: 'acct_1RJd8wQ1eJoLeXYe',
        stripeConnectOnboardingStatus: 'active',
      },
      amountEuros: 50,
      purchaserEmail: 'guest@example.com',
      purchaserName: 'Guest Buyer',
      userId: null,
      customerId: null,
      payload,
    })

    expect(calculateBookingFeeAmount).toHaveBeenCalledWith({
      payload,
      tenantId: 11,
      productType: 'gift-voucher',
      classPriceAmount: 5000,
    })
    expect(result).toMatchObject({
      client_secret: 'pi_guest_1_secret',
      voucherAmountCents: 5000,
      bookingFeeAmountCents: 150,
      totalAmountCents: 5150,
    })
    expect(paymentIntentsCreate).toHaveBeenCalledTimes(1)
    const [params, options] = paymentIntentsCreate.mock.calls[0]
    expect(options).toEqual({ stripeAccount: 'acct_1RJd8wQ1eJoLeXYe' })
    expect(params).toMatchObject({
      amount: 5150,
      currency: 'eur',
      application_fee_amount: 150,
      receipt_email: 'guest@example.com',
      metadata: expect.objectContaining({
        type: 'gift_voucher_purchase',
        amountEuros: '50.00',
        voucherAmountCents: '5000',
        bookingFeeAmount: '150',
      }),
    })
    expect(params.customer).toBeUndefined()
    expect(params.on_behalf_of).toBeUndefined()
    expect(params.transfer_data).toBeUndefined()
  })

  it('still attaches customer for logged-in purchasers on the Connect account', async () => {
    const { createGiftVoucherPaymentIntent } = await import(
      '@/lib/stripe-connect/createGiftVoucherPaymentIntent'
    )

    await createGiftVoucherPaymentIntent({
      tenant: {
        id: 11,
        stripeConnectAccountId: 'acct_1RJd8wQ1eJoLeXYe',
        stripeConnectOnboardingStatus: 'active',
      },
      amountEuros: 25,
      purchaserEmail: 'user@example.com',
      purchaserName: 'User',
      userId: 133,
      customerId: 'cus_abc',
      payload,
    })

    const [params, options] = paymentIntentsCreate.mock.calls[0]
    expect(options).toEqual({ stripeAccount: 'acct_1RJd8wQ1eJoLeXYe' })
    expect(params.customer).toBe('cus_abc')
    expect(params.metadata.userId).toBe('133')
    expect(params.application_fee_amount).toBe(150)
  })

  it('omits application_fee_amount when fee is zero', async () => {
    calculateBookingFeeAmount.mockResolvedValue(0)
    const { createGiftVoucherPaymentIntent } = await import(
      '@/lib/stripe-connect/createGiftVoucherPaymentIntent'
    )

    await createGiftVoucherPaymentIntent({
      tenant: {
        id: 11,
        stripeConnectAccountId: 'acct_1RJd8wQ1eJoLeXYe',
        stripeConnectOnboardingStatus: 'active',
      },
      amountEuros: 10,
      purchaserEmail: 'guest@example.com',
      purchaserName: 'Guest',
      payload,
    })

    const [params] = paymentIntentsCreate.mock.calls[0]
    expect(params.amount).toBe(1000)
    expect(params.application_fee_amount).toBeUndefined()
  })
})

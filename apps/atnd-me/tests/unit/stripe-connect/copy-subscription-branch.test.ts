import { describe, expect, it, vi } from 'vitest'

import {
  copyInvoiceBranchOntoCharge,
  copySubscriptionBranchOntoInvoice,
} from '@/lib/stripe-connect/copySubscriptionBranch'

describe('copySubscriptionBranchOntoInvoice', () => {
  it('copies the subscription branch onto the invoice', async () => {
    const update = vi.fn().mockResolvedValue({})

    const result = await copySubscriptionBranchOntoInvoice({
      stripeAccount: 'acct_1',
      stripe: { invoices: { update } },
      invoice: {
        id: 'in_1',
        metadata: {},
        parent: {
          subscription_details: {
            metadata: {
              branchName: 'Rathmines',
              branchSlug: 'rathmines',
              tenantId: '3',
            },
          },
        },
      },
    })

    expect(result).toBe('updated')
    expect(update).toHaveBeenCalledWith(
      'in_1',
      { metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' } },
      { stripeAccount: 'acct_1' },
    )
  })

  it('skips the update when the invoice already has the same branch', async () => {
    const update = vi.fn().mockResolvedValue({})

    const result = await copySubscriptionBranchOntoInvoice({
      stripeAccount: 'acct_1',
      stripe: { invoices: { update } },
      invoice: {
        id: 'in_1',
        metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' },
        parent: {
          subscription_details: {
            metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' },
          },
        },
      },
    })

    expect(result).toBe('skipped')
    expect(update).not.toHaveBeenCalled()
  })

  it('succeeds without updating when a branch key is missing', async () => {
    const update = vi.fn().mockResolvedValue({})

    const result = await copySubscriptionBranchOntoInvoice({
      stripeAccount: 'acct_1',
      stripe: { invoices: { update } },
      invoice: {
        id: 'in_1',
        metadata: {},
        parent: {
          subscription_details: {
            metadata: { branchName: 'Rathmines' },
          },
        },
      },
    })

    expect(result).toBe('skipped')
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects when the invoice update fails', async () => {
    const update = vi.fn().mockRejectedValue(new Error('stripe down'))

    await expect(
      copySubscriptionBranchOntoInvoice({
        stripeAccount: 'acct_1',
        stripe: { invoices: { update } },
        invoice: {
          id: 'in_1',
          metadata: {},
          parent: {
            subscription_details: {
              metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' },
            },
          },
        },
      }),
    ).rejects.toThrow('stripe down')
  })
})

describe('copyInvoiceBranchOntoCharge', () => {
  it('copies the invoice branch onto the charge from invoice payments', async () => {
    const update = vi.fn().mockResolvedValue({})
    const retrieve = vi.fn().mockResolvedValue({ id: 'pi_1', latest_charge: 'ch_1' })

    const result = await copyInvoiceBranchOntoCharge({
      stripeAccount: 'acct_1',
      stripe: {
        paymentIntents: { retrieve },
        charges: { update },
      },
      invoice: {
        id: 'in_1',
        metadata: { branchName: 'Rathmines', branchSlug: 'rathmines', tenantId: '3' },
        payments: {
          data: [
            {
              status: 'paid',
              payment: { type: 'payment_intent', payment_intent: 'pi_1' },
            },
          ],
        },
      },
    })

    expect(result).toBe('updated')
    expect(retrieve).toHaveBeenCalledWith(
      'pi_1',
      { expand: ['latest_charge'] },
      { stripeAccount: 'acct_1' },
    )
    expect(update).toHaveBeenCalledWith(
      'ch_1',
      { metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' } },
      { stripeAccount: 'acct_1' },
    )
  })

  it('skips the charge update when the charge already has the same branch', async () => {
    const update = vi.fn().mockResolvedValue({})
    const retrieve = vi.fn().mockResolvedValue({
      id: 'pi_1',
      latest_charge: {
        id: 'ch_1',
        metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' },
      },
    })

    const result = await copyInvoiceBranchOntoCharge({
      stripeAccount: 'acct_1',
      stripe: { paymentIntents: { retrieve }, charges: { update } },
      invoice: {
        id: 'in_1',
        metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' },
        payments: {
          data: [
            {
              status: 'paid',
              payment: { type: 'payment_intent', payment_intent: 'pi_1' },
            },
          ],
        },
      },
    })

    expect(result).toBe('skipped')
    expect(retrieve).toHaveBeenCalledWith(
      'pi_1',
      { expand: ['latest_charge'] },
      { stripeAccount: 'acct_1' },
    )
    expect(update).not.toHaveBeenCalled()
  })

  it('succeeds without updating the charge when a branch key is missing', async () => {
    const update = vi.fn().mockResolvedValue({})
    const retrieve = vi.fn()

    const result = await copyInvoiceBranchOntoCharge({
      stripeAccount: 'acct_1',
      stripe: { paymentIntents: { retrieve }, charges: { update } },
      invoice: {
        id: 'in_1',
        metadata: { branchName: 'Rathmines' },
        payments: {
          data: [
            {
              status: 'paid',
              payment: { type: 'payment_intent', payment_intent: 'pi_1' },
            },
          ],
        },
      },
    })

    expect(result).toBe('skipped')
    expect(retrieve).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('loads invoice payments when the paid invoice does not include them', async () => {
    const update = vi.fn().mockResolvedValue({})
    const retrievePaymentIntent = vi.fn().mockResolvedValue({ id: 'pi_1', latest_charge: 'ch_1' })
    const retrieveInvoice = vi.fn().mockResolvedValue({
      id: 'in_1',
      payments: {
        data: [
          {
            status: 'paid',
            payment: { type: 'payment_intent', payment_intent: 'pi_1' },
          },
        ],
      },
    })

    const result = await copyInvoiceBranchOntoCharge({
      stripeAccount: 'acct_1',
      stripe: {
        invoices: { retrieve: retrieveInvoice },
        paymentIntents: { retrieve: retrievePaymentIntent },
        charges: { update },
      },
      invoice: {
        id: 'in_1',
        metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' },
      },
    })

    expect(result).toBe('updated')
    expect(retrieveInvoice).toHaveBeenCalledWith(
      'in_1',
      { expand: ['payments'] },
      { stripeAccount: 'acct_1' },
    )
    expect(update).toHaveBeenCalledWith(
      'ch_1',
      { metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' } },
      { stripeAccount: 'acct_1' },
    )
  })
})

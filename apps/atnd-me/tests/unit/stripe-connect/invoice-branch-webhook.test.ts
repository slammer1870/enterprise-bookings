import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockUpdateInvoice, mockGetPlatformStripe, mockPayload } = vi.hoisted(() => ({
  mockUpdateInvoice: vi.fn(),
  mockGetPlatformStripe: vi.fn(),
  mockPayload: {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    findByID: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn() },
  },
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/webhookVerify', () => ({
  verifyStripeConnectWebhook: vi.fn(),
}))

vi.mock('@/lib/stripe-connect/webhookProcessed', () => ({
  hasProcessedStripeConnectEvent: vi.fn(),
  markStripeConnectEventProcessed: vi.fn(),
}))

vi.mock('@/lib/stripe/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/stripe/platform')>()
  return {
    ...actual,
    getPlatformStripe: mockGetPlatformStripe,
  }
})

import { POST } from '@/app/api/stripe/webhook/route'
import * as webhookVerify from '@/lib/stripe-connect/webhookVerify'
import * as webhookProcessed from '@/lib/stripe-connect/webhookProcessed'

function request(body: string) {
  return new NextRequest('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 't=123,v1=valid',
    },
    body,
  })
}

describe('Connect invoice branch webhook', () => {
  beforeEach(() => {
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReset()
    vi.mocked(webhookProcessed.markStripeConnectEventProcessed).mockReset()
    vi.mocked(webhookProcessed.hasProcessedStripeConnectEvent).mockReturnValue(false)
    mockUpdateInvoice.mockReset()
    mockUpdateInvoice.mockResolvedValue({})
    mockGetPlatformStripe.mockReset()
    mockGetPlatformStripe.mockReturnValue({
      invoices: { update: mockUpdateInvoice },
    })
  })

  it('copies the subscription branch onto the invoice and then marks the event processed', async () => {
    const event = {
      id: 'evt_invoice_created_1',
      type: 'invoice.created',
      account: 'acct_1',
      data: {
        object: {
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
      },
    }
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

    const res = await POST(request(JSON.stringify(event)))

    expect(res.status).toBe(200)
    expect(mockUpdateInvoice).toHaveBeenCalledWith(
      'in_1',
      { metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' } },
      { stripeAccount: 'acct_1' },
    )
    expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith(
      'evt_invoice_created_1',
    )
  })

  it('returns 200 without updating the invoice when a branch key is missing', async () => {
    const event = {
      id: 'evt_invoice_created_missing',
      type: 'invoice.created',
      account: 'acct_1',
      data: {
        object: {
          id: 'in_1',
          metadata: {},
          parent: {
            subscription_details: {
              metadata: { branchName: 'Rathmines' },
            },
          },
        },
      },
    }
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

    const res = await POST(request(JSON.stringify(event)))

    expect(res.status).toBe(200)
    expect(mockUpdateInvoice).not.toHaveBeenCalled()
    expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith(
      'evt_invoice_created_missing',
    )
  })

  it('does not mark the event processed when the invoice update fails', async () => {
    mockUpdateInvoice.mockRejectedValue(new Error('stripe down'))
    const event = {
      id: 'evt_invoice_created_fail',
      type: 'invoice.created',
      account: 'acct_1',
      data: {
        object: {
          id: 'in_1',
          metadata: {},
          parent: {
            subscription_details: {
              metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' },
            },
          },
        },
      },
    }
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

    await expect(POST(request(JSON.stringify(event)))).rejects.toThrow('stripe down')
    expect(webhookProcessed.markStripeConnectEventProcessed).not.toHaveBeenCalled()
  })

  it('copies the invoice branch onto the charge and then marks the event processed', async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: 'pi_1', latest_charge: 'ch_1' })
    const updateCharge = vi.fn().mockResolvedValue({})
    mockGetPlatformStripe.mockReturnValue({
      invoices: { update: mockUpdateInvoice },
      paymentIntents: { retrieve },
      charges: { update: updateCharge },
    })
    const event = {
      id: 'evt_invoice_paid_1',
      type: 'invoice.paid',
      account: 'acct_1',
      data: {
        object: {
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
      },
    }
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

    const res = await POST(request(JSON.stringify(event)))

    expect(res.status).toBe(200)
    expect(updateCharge).toHaveBeenCalledWith(
      'ch_1',
      { metadata: { branchName: 'Rathmines', branchSlug: 'rathmines' } },
      { stripeAccount: 'acct_1' },
    )
    expect(webhookProcessed.markStripeConnectEventProcessed).toHaveBeenCalledWith(
      'evt_invoice_paid_1',
    )
  })

  it('does not mark the event processed when the charge update fails', async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: 'pi_1', latest_charge: 'ch_1' })
    const updateCharge = vi.fn().mockRejectedValue(new Error('stripe down'))
    mockGetPlatformStripe.mockReturnValue({
      invoices: { update: mockUpdateInvoice },
      paymentIntents: { retrieve },
      charges: { update: updateCharge },
    })
    const event = {
      id: 'evt_invoice_paid_fail',
      type: 'invoice.paid',
      account: 'acct_1',
      data: {
        object: {
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
      },
    }
    vi.mocked(webhookVerify.verifyStripeConnectWebhook).mockReturnValue(event as never)

    await expect(POST(request(JSON.stringify(event)))).rejects.toThrow('stripe down')
    expect(webhookProcessed.markStripeConnectEventProcessed).not.toHaveBeenCalled()
  })
})

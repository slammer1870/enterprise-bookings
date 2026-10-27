import { isValidElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { confirmDropInPaymentOnReturn, getSession, payload } = vi.hoisted(() => ({
  confirmDropInPaymentOnReturn: vi.fn(),
  getSession: vi.fn(),
  payload: {
    find: vi.fn(),
    logger: { error: vi.fn() },
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
  headers: vi.fn(async () => ({ get: () => null })),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`)
  }),
}))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn(async () => payload),
}))

vi.mock('@/lib/auth/context/get-context-props', () => ({
  getSession,
}))

vi.mock('@/lib/receipt/get-receipt-data', () => ({
  getReceiptFromPaymentIntent: vi.fn(async () => null),
  getReceiptFromBookingIds: vi.fn(async () => null),
}))

vi.mock('@/utilities/tenantRequest', () => ({
  getTenantSlugFromRequest: () => 'studio',
}))

vi.mock('@/lib/stripe-connect/test-accounts', () => ({
  isStripeTestAccount: () => false,
}))

vi.mock('@/lib/stripe-connect/confirm-drop-in-on-return', () => ({
  confirmDropInPaymentOnReturn,
}))

import SuccessPage from '@/app/(frontend)/success/page'

function hasHomeLink(node: ReactNode): boolean {
  if (!isValidElement(node)) return false
  const props = node.props as { href?: string; children?: ReactNode }
  if (props.href === '/') return true
  const children = Array.isArray(props.children) ? props.children : [props.children]
  return children.some((child) => hasHomeLink(child))
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((child) => textOf(child)).join('')
  if (!isValidElement(node)) return ''
  return textOf((node.props as { children?: ReactNode }).children)
}

describe('success page drop-in return', () => {
  beforeEach(() => {
    confirmDropInPaymentOnReturn.mockReset()
    getSession.mockReset()
    payload.find.mockReset()
    payload.find.mockResolvedValue({
      docs: [
        {
          id: 3,
          stripeConnectAccountId: 'acct_live',
          stripeConnectOnboardingStatus: 'active',
        },
      ],
    })
  })

  it('does not offer Back to home until the drop-in booking is confirmed', async () => {
    let release: (ready: boolean) => void = () => {}
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    confirmDropInPaymentOnReturn.mockImplementation(() => gate)
    getSession.mockResolvedValue({ user: { id: 5 } })

    let settled = false
    const pending = SuccessPage({
      searchParams: Promise.resolve({
        payment_intent: 'pi_dropin',
        redirect_status: 'succeeded',
      }),
    }).then((page) => {
      settled = true
      return page
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(settled).toBe(false)
    expect(confirmDropInPaymentOnReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        paymentIntentId: 'pi_dropin',
        tenantId: 3,
        stripeAccountId: 'acct_live',
      }),
    )

    release(true)
    const page = await pending
    expect(hasHomeLink(page)).toBe(true)
    expect(textOf(page)).toMatch(/has been confirmed/i)
  })

  it('confirms a processing payment before offering Back to home', async () => {
    let release: (ready: boolean) => void = () => {}
    const gate = new Promise<boolean>((resolve) => {
      release = resolve
    })
    confirmDropInPaymentOnReturn.mockImplementation(() => gate)
    getSession.mockResolvedValue({ user: { id: 5 } })

    let settled = false
    const pending = SuccessPage({
      searchParams: Promise.resolve({
        payment_intent: 'pi_dropin',
        redirect_status: 'processing',
      }),
    }).then((page) => {
      settled = true
      return page
    })

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(settled).toBe(false)
    expect(confirmDropInPaymentOnReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        paymentIntentId: 'pi_dropin',
        tenantId: 3,
      }),
    )

    release(true)
    const page = await pending
    expect(hasHomeLink(page)).toBe(true)
    expect(textOf(page)).toMatch(/has been confirmed/i)
  })

  it('does not offer Back to home while a processing payment has no confirmed booking', async () => {
    confirmDropInPaymentOnReturn.mockResolvedValue(false)
    getSession.mockResolvedValue({ user: { id: 5 } })

    const page = await SuccessPage({
      searchParams: Promise.resolve({
        payment_intent: 'pi_dropin',
        redirect_status: 'processing',
      }),
    })

    expect(confirmDropInPaymentOnReturn).toHaveBeenCalled()
    expect(textOf(page)).not.toMatch(/has been confirmed/i)
    expect(textOf(page)).toMatch(/still processing/i)
    expect(hasHomeLink(page)).toBe(false)
  })

  it('does not confirm a guest checkout that has no session', async () => {
    getSession.mockResolvedValue(null)

    const page = await SuccessPage({
      searchParams: Promise.resolve({
        payment_intent: 'pi_guest',
        redirect_status: 'succeeded',
      }),
    })

    expect(confirmDropInPaymentOnReturn).not.toHaveBeenCalled()
    expect(hasHomeLink(page)).toBe(true)
  })
})

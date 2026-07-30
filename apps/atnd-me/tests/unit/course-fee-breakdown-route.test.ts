/**
 * Course fee-breakdown API: returns class price + booking fee for enroll panel disclosure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockPayload, mockCalculateBookingFeeAmount, mockResolveTenantSlugOrId, mockResolveTenantForConnect } =
  vi.hoisted(() => ({
    mockPayload: {
      findByID: vi.fn(),
    },
    mockCalculateBookingFeeAmount: vi.fn(),
    mockResolveTenantSlugOrId: vi.fn(),
    mockResolveTenantForConnect: vi.fn(),
  }))

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/bookingFee', () => ({
  calculateBookingFeeAmount: mockCalculateBookingFeeAmount,
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  resolveTenantSlugOrId: mockResolveTenantSlugOrId,
  resolveTenantForConnect: mockResolveTenantForConnect,
}))

import { POST } from '@/app/api/courses/fee-breakdown/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/courses/fee-breakdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/courses/fee-breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveTenantSlugOrId.mockReturnValue(null)
    mockCalculateBookingFeeAmount.mockResolvedValue(240)
  })

  it('returns classPriceCents + bookingFeeCents + totalCents for a valid course', async () => {
    mockPayload.findByID.mockResolvedValue({
      id: 10,
      status: 'open',
      tenant: 4,
    })

    const res = await POST(makeRequest({ courseId: 10, classPriceCents: 8000 }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({
      classPriceCents: 8000,
      bookingFeeCents: 240,
      totalCents: 8240,
    })
    expect(mockCalculateBookingFeeAmount).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 4,
        productType: 'course',
        classPriceAmount: 8000,
      }),
    )
  })

  it('returns 400 when courseId or classPriceCents missing', async () => {
    const res = await POST(makeRequest({ courseId: 10 }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when course is missing', async () => {
    mockPayload.findByID.mockResolvedValue(null)
    const res = await POST(makeRequest({ courseId: 99, classPriceCents: 1000 }))
    expect(res.status).toBe(404)
  })

  it('returns 404 when request tenant does not match course tenant', async () => {
    mockPayload.findByID.mockResolvedValue({
      id: 10,
      status: 'open',
      tenant: 4,
    })
    mockResolveTenantSlugOrId.mockReturnValue('other-tenant')
    mockResolveTenantForConnect.mockResolvedValue({ id: 99 })

    const res = await POST(makeRequest({ courseId: 10, classPriceCents: 8000 }))
    expect(res.status).toBe(404)
  })
})

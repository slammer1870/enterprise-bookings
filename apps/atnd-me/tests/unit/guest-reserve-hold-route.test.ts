/**
 * Guest event checkout: reserve hold as soon as Continue is clicked
 * (before PaymentIntent), so page-exit release is not racing PI creation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockEnsureGuestUser,
  mockUpsertCheckoutHold,
  mockPayload,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockEnsureGuestUser: vi.fn(),
  mockUpsertCheckoutHold: vi.fn(),
  mockCheckRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  mockPayload: {
    findByID: vi.fn(),
  },
}))

vi.mock('@/lib/booking/ensureGuestUser', () => ({
  ensureGuestUser: mockEnsureGuestUser,
}))

vi.mock('@repo/bookings-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/bookings-payments')>()
  return {
    ...actual,
    upsertCheckoutHold: mockUpsertCheckoutHold,
  }
})

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/stripe-connect/api-helpers', () => ({
  resolveTenantSlugOrId: vi.fn().mockReturnValue(null),
  resolveTenantForConnect: vi.fn(),
}))

vi.mock('@/lib/onboarding/rateLimit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

import { POST } from '@/app/api/events/guest-reserve-hold/route'

const TIMESLOT_ID = 28093
const TENANT_ID = 4

function makeRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  } as unknown as import('next/server').NextRequest
}

describe('POST /api/events/guest-reserve-hold', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockEnsureGuestUser.mockResolvedValue({
      userId: 101,
      created: true,
      email: 'sam.guest@example.com',
      name: 'Sam Guest',
    })
    mockUpsertCheckoutHold.mockResolvedValue({ holdId: 55, quantity: 2 })
    mockPayload.findByID.mockResolvedValue({
      id: TIMESLOT_ID,
      active: true,
      tenant: TENANT_ID,
    })
  })

  it('creates a guest user and upserts a checkout hold', async () => {
    const res = await POST(
      makeRequest({
        timeslotId: TIMESLOT_ID,
        quantity: 2,
        guestName: 'Sam Guest',
        guestEmail: 'sam.guest@example.com',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ holdId: 55, quantity: 2 })
    expect(mockEnsureGuestUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sam.guest@example.com',
        tenantId: TENANT_ID,
      }),
    )
    expect(mockUpsertCheckoutHold).toHaveBeenCalledWith(
      mockPayload,
      expect.objectContaining({
        timeslotId: TIMESLOT_ID,
        userId: 101,
        quantity: 2,
      }),
    )
  })

  it('rejects incomplete emails', async () => {
    const res = await POST(
      makeRequest({
        timeslotId: TIMESLOT_ID,
        guestName: 'Sam',
        guestEmail: 'sam@',
      }),
    )
    expect(res.status).toBe(400)
    expect(mockUpsertCheckoutHold).not.toHaveBeenCalled()
  })
})

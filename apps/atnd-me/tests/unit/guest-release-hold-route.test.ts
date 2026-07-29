/**
 * Guest event checkout hold release (no browser session).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockReleaseCheckoutHold, mockPayload, mockCheckRateLimit } = vi.hoisted(() => ({
  mockReleaseCheckoutHold: vi.fn(),
  mockCheckRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  mockPayload: {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
  },
}))

vi.mock('@repo/bookings-payments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/bookings-payments')>()
  return {
    ...actual,
    releaseCheckoutHold: mockReleaseCheckoutHold,
  }
})

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn().mockResolvedValue(mockPayload),
}))

vi.mock('@/lib/onboarding/rateLimit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

import { POST } from '@/app/api/events/guest-release-hold/route'

const TIMESLOT_ID = 28093

function makeRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  } as unknown as import('next/server').NextRequest
}

describe('POST /api/events/guest-release-hold', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })
    mockReleaseCheckoutHold.mockResolvedValue({ released: 1 })
  })

  it('releases the hold for the guest user matched by email', async () => {
    mockPayload.find.mockResolvedValue({ docs: [{ id: 101 }], totalDocs: 1 })

    const res = await POST(
      makeRequest({ timeslotId: TIMESLOT_ID, guestEmail: 'sam.guest@example.com' }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.released).toBe(1)
    expect(mockReleaseCheckoutHold).toHaveBeenCalledWith(
      mockPayload,
      expect.objectContaining({
        timeslotId: TIMESLOT_ID,
        userId: 101,
      }),
    )
  })

  it('returns released: 0 when no guest user exists', async () => {
    const res = await POST(
      makeRequest({ timeslotId: TIMESLOT_ID, guestEmail: 'nobody@example.com' }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.released).toBe(0)
    expect(mockReleaseCheckoutHold).not.toHaveBeenCalled()
  })

  it('rejects incomplete emails', async () => {
    const res = await POST(makeRequest({ timeslotId: TIMESLOT_ID, guestEmail: 'sam@' }))
    expect(res.status).toBe(400)
    expect(mockReleaseCheckoutHold).not.toHaveBeenCalled()
  })

  it('rejects missing timeslotId', async () => {
    const res = await POST(makeRequest({ guestEmail: 'sam.guest@example.com' }))
    expect(res.status).toBe(400)
    expect(mockReleaseCheckoutHold).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeRemainderAmount,
  issueRemainderDiscountCodeIfNeeded,
} from '@/lib/stripe-connect/issueRemainderDiscountCode'
import { addYearsIso } from '@/lib/stripe-connect/giftVoucherImport'

const ROOT_PURCHASED = '2026-01-15T12:00:00.000Z'
const ROOT_EXPIRES = addYearsIso(ROOT_PURCHASED, 5)

function makePayload(overrides?: {
  parent?: Record<string, unknown> | null
  existingRemainder?: Record<string, unknown> | null
  createImpl?: ReturnType<typeof vi.fn>
}) {
  const parent =
    overrides && 'parent' in overrides
      ? overrides.parent
      : {
          id: 10,
          code: 'GIFT100',
          type: 'amount_off',
          value: 100,
          currency: 'eur',
          maxRedemptions: 1,
          rootPurchasedAt: ROOT_PURCHASED,
          createdAt: ROOT_PURCHASED,
          status: 'active',
        }

  const find = vi.fn(async ({ where }: { where?: { and?: Array<Record<string, unknown>> } }) => {
    const and = where?.and ?? []
    const hasParentRel = and.some((c) => 'parentDiscountCode' in c)
    if (hasParentRel) {
      return { docs: overrides?.existingRemainder ? [overrides.existingRemainder] : [] }
    }
    const codeClause = and.find((c) => 'code' in c) as
      | { code?: { equals?: string } }
      | undefined
    const codeEquals = codeClause?.code?.equals
    if (typeof codeEquals === 'string') {
      // Parent lookup by exact code
      if (
        parent &&
        String(parent.code ?? '').toUpperCase() === codeEquals.toUpperCase()
      ) {
        return { docs: [parent] }
      }
      // Uniqueness check for generated remainder codes
      return { docs: [] }
    }
    // Legacy case-insensitive scan fallback
    return { docs: parent ? [parent] : [] }
  })

  const create =
    overrides?.createImpl ??
    vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 99,
      ...data,
    }))

  const sendEmail = vi.fn().mockResolvedValue(undefined)
  const logger = { error: vi.fn(), warn: vi.fn() }

  return {
    find,
    create,
    sendEmail,
    logger,
  }
}

describe('computeRemainderAmount', () => {
  it('returns leftover when coupon exceeds class price', () => {
    expect(computeRemainderAmount(100, 20)).toBe(80)
    expect(computeRemainderAmount(30, 19)).toBe(11)
  })

  it('returns 0 on exact match or under', () => {
    expect(computeRemainderAmount(20, 20)).toBe(0)
    expect(computeRemainderAmount(10, 20)).toBe(0)
  })
})

describe('issueRemainderDiscountCodeIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates child for amount_off maxRedemptions=1 with leftover', async () => {
    const payload = makePayload()
    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT100',
      classPriceBeforeDiscount: 20,
      userId: 5,
      userEmail: 'user@example.com',
      bookingId: 77,
      holdId: 3,
    })

    expect(result.issued).toBe(true)
    if (!result.issued) return
    expect(result.remainderValue).toBe(80)
    expect(result.redeemBy).toBe(ROOT_EXPIRES)
    expect(payload.create).toHaveBeenCalledTimes(1)
    const data = payload.create.mock.calls[0]?.[0]?.data
    expect(data).toMatchObject({
      type: 'amount_off',
      value: 80,
      maxRedemptions: 1,
      rootPurchasedAt: new Date(ROOT_PURCHASED).toISOString(),
      redeemBy: ROOT_EXPIRES,
      parentDiscountCode: 10,
      sourceBookingId: 77,
      sourceHoldId: 3,
    })
    expect(payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringContaining(result.remainderCode),
      }),
    )
  })

  it('second hop preserves rootPurchasedAt and redeemBy', async () => {
    const payload = makePayload({
      parent: {
        id: 20,
        code: 'GIFT100R1',
        type: 'amount_off',
        value: 80,
        currency: 'eur',
        maxRedemptions: 1,
        rootPurchasedAt: ROOT_PURCHASED,
        createdAt: '2026-03-01T00:00:00.000Z',
        status: 'active',
      },
    })

    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT100R1',
      classPriceBeforeDiscount: 20,
      userId: 5,
      userEmail: 'user@example.com',
      bookingId: 88,
    })

    expect(result.issued).toBe(true)
    if (!result.issued) return
    expect(result.remainderValue).toBe(60)
    expect(result.redeemBy).toBe(ROOT_EXPIRES)
    const data = payload.create.mock.calls[0]?.[0]?.data
    expect(data.rootPurchasedAt).toBe(new Date(ROOT_PURCHASED).toISOString())
    expect(data.redeemBy).toBe(ROOT_EXPIRES)
    // Must not be ~now+5y
    const fiveYearsFromNow = addYearsIso(new Date(), 5)
    expect(data.redeemBy).not.toBe(fiveYearsFromNow)
  })

  it('skips exact match', async () => {
    const payload = makePayload()
    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT100',
      classPriceBeforeDiscount: 100,
      userId: 5,
      userEmail: 'user@example.com',
      bookingId: 1,
    })
    expect(result).toEqual({ issued: false, reason: 'no_remainder' })
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.sendEmail).not.toHaveBeenCalled()
  })

  describe('maxRedemptions === 1 gate', () => {
    async function runWithMaxRedemptions(
      maxRedemptions: number | null | undefined,
      code = 'GATE',
    ) {
      const payload = makePayload({
        parent: {
          id: 10,
          code,
          type: 'amount_off',
          value: 100,
          currency: 'eur',
          maxRedemptions,
          rootPurchasedAt: ROOT_PURCHASED,
          createdAt: ROOT_PURCHASED,
        },
      })
      const result = await issueRemainderDiscountCodeIfNeeded({
        payload: payload as never,
        tenantId: 1,
        discountCode: code,
        classPriceBeforeDiscount: 20,
        userId: 5,
        userEmail: 'u@example.com',
        bookingId: 1,
      })
      return { payload, result }
    }

    it('issues remainder only when maxRedemptions is exactly 1', async () => {
      const { payload, result } = await runWithMaxRedemptions(1, 'ONCE')
      expect(result.issued).toBe(true)
      expect(payload.create).toHaveBeenCalledTimes(1)
      expect(payload.create.mock.calls[0]?.[0]?.data.maxRedemptions).toBe(1)
    })

    it('skips when maxRedemptions is null (unlimited)', async () => {
      const { payload, result } = await runWithMaxRedemptions(null, 'UNLIM')
      expect(result).toEqual({ issued: false, reason: 'max_redemptions_not_one' })
      expect(payload.create).not.toHaveBeenCalled()
      expect(payload.sendEmail).not.toHaveBeenCalled()
    })

    it('skips when maxRedemptions is undefined', async () => {
      const { payload, result } = await runWithMaxRedemptions(undefined, 'UNDEF')
      expect(result).toEqual({ issued: false, reason: 'max_redemptions_not_one' })
      expect(payload.create).not.toHaveBeenCalled()
    })

    it('skips when maxRedemptions is greater than 1', async () => {
      for (const max of [2, 5, 99]) {
        const { payload, result } = await runWithMaxRedemptions(max, `M${max}`)
        expect(result).toEqual({ issued: false, reason: 'max_redemptions_not_one' })
        expect(payload.create).not.toHaveBeenCalled()
      }
    })

    it('skips when maxRedemptions is 0', async () => {
      const { payload, result } = await runWithMaxRedemptions(0, 'ZERO')
      expect(result).toEqual({ issued: false, reason: 'max_redemptions_not_one' })
      expect(payload.create).not.toHaveBeenCalled()
    })

    it('always creates the child code with maxRedemptions: 1 so leftover can chain', async () => {
      const { payload, result } = await runWithMaxRedemptions(1, 'CHAIN')
      expect(result.issued).toBe(true)
      const data = payload.create.mock.calls[0]?.[0]?.data
      expect(data.maxRedemptions).toBe(1)
      expect(data.type).toBe('amount_off')
      expect(data.value).toBe(80)
    })
  })

  it('skips percentage_off', async () => {
    const payload = makePayload({
      parent: {
        id: 10,
        code: 'PCT',
        type: 'percentage_off',
        value: 50,
        maxRedemptions: 1,
        rootPurchasedAt: ROOT_PURCHASED,
        createdAt: ROOT_PURCHASED,
      },
    })
    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'PCT',
      classPriceBeforeDiscount: 20,
      userId: 5,
      userEmail: 'u@example.com',
      bookingId: 1,
    })
    expect(result).toEqual({ issued: false, reason: 'not_amount_off' })
  })

  it('skips when root+5y is in the past', async () => {
    const payload = makePayload({
      parent: {
        id: 10,
        code: 'OLD',
        type: 'amount_off',
        value: 100,
        maxRedemptions: 1,
        rootPurchasedAt: '2010-01-01T00:00:00.000Z',
        createdAt: '2010-01-01T00:00:00.000Z',
      },
    })
    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'OLD',
      classPriceBeforeDiscount: 20,
      userId: 5,
      userEmail: 'u@example.com',
      bookingId: 1,
    })
    expect(result).toEqual({ issued: false, reason: 'root_expired' })
  })

  it('falls back to createdAt when rootPurchasedAt missing', async () => {
    const createdAt = '2026-02-01T00:00:00.000Z'
    const payload = makePayload({
      parent: {
        id: 10,
        code: 'GIFT',
        type: 'amount_off',
        value: 50,
        maxRedemptions: 1,
        rootPurchasedAt: null,
        createdAt,
      },
    })
    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT',
      classPriceBeforeDiscount: 10,
      userId: 5,
      userEmail: 'u@example.com',
      bookingId: 1,
    })
    expect(result.issued).toBe(true)
    const data = payload.create.mock.calls[0]?.[0]?.data
    expect(data.rootPurchasedAt).toBe(new Date(createdAt).toISOString())
    expect(data.redeemBy).toBe(addYearsIso(createdAt, 5))
  })

  it('is idempotent for the same parent + booking', async () => {
    const payload = makePayload({
      existingRemainder: {
        id: 55,
        code: 'EXISTING80',
        value: 80,
        redeemBy: ROOT_EXPIRES,
      },
    })
    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT100',
      classPriceBeforeDiscount: 20,
      userId: 5,
      userEmail: 'u@example.com',
      bookingId: 77,
    })
    expect(result).toEqual({
      issued: true,
      remainderCode: 'EXISTING80',
      remainderValue: 80,
      redeemBy: ROOT_EXPIRES,
      discountCodeId: 55,
    })
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('creates without throwing when email is missing', async () => {
    const payload = makePayload()
    const result = await issueRemainderDiscountCodeIfNeeded({
      payload: payload as never,
      tenantId: 1,
      discountCode: 'GIFT100',
      classPriceBeforeDiscount: 20,
      userId: 5,
      userEmail: null,
      bookingId: 1,
    })
    expect(result.issued).toBe(true)
    expect(payload.create).toHaveBeenCalled()
    expect(payload.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalled()
  })
})

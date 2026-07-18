import { describe, expect, it } from 'vitest'
import {
  addYearsIso,
  isValidGiftVoucherImportRow,
  resolveRedeemBy,
  resolveRootPurchasedAt,
  sanitizeDiscountCode,
} from '@/lib/stripe-connect/giftVoucherImport'

describe('giftVoucherImport helpers', () => {
  describe('sanitizeDiscountCode', () => {
    it('uppercases and keeps valid codes', () => {
      expect(sanitizeDiscountCode('gift30', 'x')).toBe('GIFT30')
    })

    it('strips invalid characters', () => {
      expect(sanitizeDiscountCode('gift-30!', 'x')).toBe('GIFT30')
    })

    it('falls back to seed when raw is unusable', () => {
      const code = sanitizeDiscountCode('!!', 'old-voucher-99')
      expect(code).toMatch(/^[A-Z0-9]{3,24}$/)
      expect(code.startsWith('OLDVOUCHER99') || code.includes('OLD')).toBe(true)
    })
  })

  describe('resolveRedeemBy / rootPurchasedAt', () => {
    it('uses purchasedAt + 5 years when expiresAt omitted', () => {
      const root = resolveRootPurchasedAt({
        externalId: '1',
        remainingAmount: 30,
        purchasedAt: '2026-01-15T12:00:00.000Z',
      })
      expect(root.toISOString()).toBe('2026-01-15T12:00:00.000Z')
      expect(resolveRedeemBy({ externalId: '1', remainingAmount: 30 }, root)).toBe(
        addYearsIso('2026-01-15T12:00:00.000Z', 5),
      )
    })

    it('prefers expiresAt override', () => {
      const root = new Date('2026-01-15T12:00:00.000Z')
      expect(
        resolveRedeemBy(
          {
            externalId: '1',
            remainingAmount: 30,
            expiresAt: '2028-06-01T00:00:00.000Z',
          },
          root,
        ),
      ).toBe('2028-06-01T00:00:00.000Z')
    })
  })

  describe('isValidGiftVoucherImportRow', () => {
    it('accepts valid rows', () => {
      expect(
        isValidGiftVoucherImportRow({
          externalId: 'a',
          remainingAmount: 30.5,
        }),
      ).toBe(true)
    })

    it('rejects missing externalId or bad amount', () => {
      expect(isValidGiftVoucherImportRow({ remainingAmount: 10 })).toBe(false)
      expect(isValidGiftVoucherImportRow({ externalId: 'a', remainingAmount: 0 })).toBe(false)
      expect(isValidGiftVoucherImportRow({ externalId: 'a', remainingAmount: 1.234 })).toBe(false)
    })
  })
})

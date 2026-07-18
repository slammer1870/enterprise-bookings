/**
 * Shared types and helpers for migrating gift vouchers → DiscountCodes.
 */

export type GiftVoucherImportRow = {
  externalId: string
  code?: string
  remainingAmount: number
  /** Root purchase datetime (ISO); drives redeemBy = purchasedAt + 5 years for the whole chain */
  purchasedAt?: string
  /** Optional override for redeemBy; else purchasedAt + 5 years */
  expiresAt?: string
  customerName?: string
  email?: string
  notes?: string
}

export type GiftVoucherImportFile = {
  giftVoucherImports: GiftVoucherImportRow[]
}

const CODE_PATTERN = /^[A-Z0-9]{3,24}$/

/** Uppercase alphanumeric; strip invalid chars; pad/truncate to 3–24. */
export function sanitizeDiscountCode(raw: string, fallbackSeed: string): string {
  const fromRaw = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24)

  if (CODE_PATTERN.test(fromRaw)) return fromRaw

  const fromSeed = fallbackSeed
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20)

  const base = (fromSeed || 'GIFT').padEnd(3, '0').slice(0, 20)
  const suffix = Math.abs(hashString(raw || fallbackSeed))
    .toString(36)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
  const combined = `${base}${suffix}`.slice(0, 24)
  return combined.padEnd(3, '0')
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return h
}

export function addYearsIso(isoDate: string | Date, years: number): string {
  const d = new Date(isoDate)
  d.setUTCFullYear(d.getUTCFullYear() + years)
  return d.toISOString()
}

export function resolveRootPurchasedAt(row: GiftVoucherImportRow, now = new Date()): Date {
  if (row.purchasedAt) {
    const parsed = new Date(row.purchasedAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return now
}

export function resolveRedeemBy(
  row: GiftVoucherImportRow,
  rootPurchasedAt: Date,
): string {
  if (row.expiresAt) {
    const parsed = new Date(row.expiresAt)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return addYearsIso(rootPurchasedAt, 5)
}

export function isValidGiftVoucherImportRow(row: unknown): row is GiftVoucherImportRow {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  if (typeof r.externalId !== 'string' || !r.externalId.trim()) return false
  if (typeof r.remainingAmount !== 'number' || !(r.remainingAmount > 0)) return false
  if (Math.abs(r.remainingAmount * 100 - Math.round(r.remainingAmount * 100)) > Number.EPSILON) {
    return false
  }
  return true
}

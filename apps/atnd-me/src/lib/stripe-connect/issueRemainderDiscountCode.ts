/**
 * After a drop-in uses an amount_off / maxRedemptions=1 code for less than its full value,
 * issue a new one-time DiscountCode for the leftover and email it to the booking user.
 * Expiry is always rootPurchasedAt + 5 years (shared across the remainder chain).
 */
import type { Payload, Where } from 'payload'

import { addYearsIso } from '@/lib/stripe-connect/giftVoucherImport'
import { normalizeDiscountCode } from '@/lib/stripe-connect/discountCodes'

const REMAINDER_EPSILON = 0.009

export type IssueRemainderDiscountCodeParams = {
  payload: Payload
  tenantId: number
  discountCode: string
  /** Class price in euros before the promo was applied */
  classPriceBeforeDiscount: number
  userId: number
  userEmail?: string | null
  bookingId?: number | null
  /** For idempotency when bookingId is not yet known — use holdId */
  holdId?: number | null
}

export type IssueRemainderDiscountCodeResult =
  | {
      issued: true
      remainderCode: string
      remainderValue: number
      redeemBy: string
      discountCodeId: number
    }
  | { issued: false; reason: string }

type ParentDiscountDoc = {
  id: number
  code?: string | null
  type?: string | null
  value?: number | null
  currency?: string | null
  maxRedemptions?: number | null
  rootPurchasedAt?: string | null
  createdAt?: string | null
  redeemBy?: string | null
  status?: string | null
}

function generateRemainderCode(parentCode: string): string {
  const prefix = normalizeDiscountCode(parentCode).replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'REM'
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return `${prefix}${rand}`.slice(0, 24).padEnd(3, '0')
}

async function findParentByCode(
  payload: Payload,
  tenantId: number,
  code: string,
): Promise<ParentDiscountDoc | null> {
  const normalized = normalizeDiscountCode(code)
  if (!normalized) return null

  const match = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 5,
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { code: { equals: normalized } },
      ],
    },
  })

  const exact = match.docs[0] as ParentDiscountDoc | undefined
  if (exact) return exact

  // Legacy rows may store lowercase codes
  const legacy = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    where: {
      and: [{ tenant: { equals: tenantId } }],
    },
  })

  return (
    (legacy.docs.find(
      (d) => normalizeDiscountCode(String((d as ParentDiscountDoc).code ?? '')) === normalized,
    ) as ParentDiscountDoc | undefined) ?? null
  )
}

async function findExistingRemainder(
  payload: Payload,
  tenantId: number,
  parentId: number,
  bookingId: number | null | undefined,
  holdId: number | null | undefined,
): Promise<ParentDiscountDoc | null> {
  if (bookingId == null && holdId == null) return null

  const and: Where[] = [
    { tenant: { equals: tenantId } },
    { parentDiscountCode: { equals: parentId } },
  ]
  if (bookingId != null) {
    and.push({ sourceBookingId: { equals: bookingId } })
  } else if (holdId != null) {
    and.push({ sourceHoldId: { equals: holdId } })
  }

  const existing = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { and },
  })

  return (existing.docs[0] as ParentDiscountDoc | undefined) ?? null
}

async function ensureUniqueCode(
  payload: Payload,
  tenantId: number,
  parentCode: string,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRemainderCode(parentCode)
    const clash = await payload.find({
      collection: 'discount-codes',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [{ tenant: { equals: tenantId } }, { code: { equals: code } }],
      },
    })
    if (clash.docs.length === 0) return code
  }
  // Last resort: timestamp suffix
  const fallback = `R${Date.now().toString(36).toUpperCase()}`.slice(0, 24)
  return fallback.padEnd(3, '0')
}

export function computeRemainderAmount(
  couponValue: number,
  classPriceBeforeDiscount: number,
): number {
  const applied = Math.min(couponValue, Math.max(0, classPriceBeforeDiscount))
  const remainder = Number((couponValue - applied).toFixed(2))
  return remainder > REMAINDER_EPSILON ? remainder : 0
}

export async function issueRemainderDiscountCodeIfNeeded(
  params: IssueRemainderDiscountCodeParams,
): Promise<IssueRemainderDiscountCodeResult> {
  const {
    payload,
    tenantId,
    discountCode,
    classPriceBeforeDiscount,
    userId,
    userEmail,
    bookingId,
    holdId,
  } = params

  const parent = await findParentByCode(payload, tenantId, discountCode)
  if (!parent) {
    return { issued: false, reason: 'parent_not_found' }
  }

  if (parent.type !== 'amount_off') {
    return { issued: false, reason: 'not_amount_off' }
  }

  if (parent.maxRedemptions !== 1) {
    return { issued: false, reason: 'max_redemptions_not_one' }
  }

  if (typeof parent.value !== 'number' || !(parent.value > 0)) {
    return { issued: false, reason: 'invalid_value' }
  }

  const remainderValue = computeRemainderAmount(parent.value, classPriceBeforeDiscount)
  if (remainderValue <= 0) {
    return { issued: false, reason: 'no_remainder' }
  }

  const rootPurchasedAtRaw = parent.rootPurchasedAt ?? parent.createdAt
  if (!rootPurchasedAtRaw) {
    return { issued: false, reason: 'missing_root_purchased_at' }
  }
  const rootPurchasedAt = new Date(rootPurchasedAtRaw)
  if (Number.isNaN(rootPurchasedAt.getTime())) {
    return { issued: false, reason: 'invalid_root_purchased_at' }
  }

  const redeemBy = addYearsIso(rootPurchasedAt, 5)
  if (new Date(redeemBy).getTime() <= Date.now()) {
    return { issued: false, reason: 'root_expired' }
  }

  const existing = await findExistingRemainder(payload, tenantId, parent.id, bookingId, holdId)
  if (existing?.code) {
    return {
      issued: true,
      remainderCode: String(existing.code).toUpperCase(),
      remainderValue:
        typeof existing.value === 'number' ? existing.value : remainderValue,
      redeemBy: existing.redeemBy ? String(existing.redeemBy) : redeemBy,
      discountCodeId: existing.id,
    }
  }

  const parentCode = String(parent.code ?? discountCode).toUpperCase()
  const newCode = await ensureUniqueCode(payload, tenantId, parentCode)

  let created: { id: number; code?: string | null; value?: number | null; redeemBy?: string | null }
  try {
    created = (await payload.create({
      collection: 'discount-codes',
      data: {
        tenant: tenantId,
        name: `Remainder of ${parentCode}`,
        code: newCode,
        type: 'amount_off',
        value: remainderValue,
        currency: (parent.currency as 'eur' | 'gbp' | 'usd') || 'eur',
        duration: 'once',
        maxRedemptions: 1,
        rootPurchasedAt: rootPurchasedAt.toISOString(),
        redeemBy,
        parentDiscountCode: parent.id,
        ...(bookingId != null ? { sourceBookingId: bookingId } : {}),
        ...(holdId != null ? { sourceHoldId: holdId } : {}),
        status: 'active',
      },
      overrideAccess: true,
      context: { tenant: tenantId },
    })) as typeof created
  } catch (err) {
    payload.logger?.error?.(
      `issueRemainderDiscountCodeIfNeeded: create failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return { issued: false, reason: 'create_failed' }
  }

  const remainderCode = String(created.code ?? newCode).toUpperCase()
  const email = typeof userEmail === 'string' ? userEmail.trim() : ''

  if (email) {
    try {
      const expiryLabel = new Date(redeemBy).toLocaleDateString('en-IE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      await payload.sendEmail({
        to: email,
        subject: `Your remaining gift credit code: ${remainderCode}`,
        html: `
          <p>Hi,</p>
          <p>You used part of a one-time discount code on a class booking. Here is a new code for the unused balance:</p>
          <p><strong>Code:</strong> ${remainderCode}<br/>
          <strong>Amount:</strong> €${remainderValue.toFixed(2)}<br/>
          <strong>Expires:</strong> ${expiryLabel}</p>
          <p>Enter this code at checkout on your next drop-in booking. It can be used once.</p>
        `,
      })
    } catch (emailErr) {
      payload.logger?.error?.(
        `issueRemainderDiscountCodeIfNeeded: email failed for user ${userId}: ${
          emailErr instanceof Error ? emailErr.message : String(emailErr)
        }`,
      )
    }
  } else {
    payload.logger?.warn?.(
      `issueRemainderDiscountCodeIfNeeded: no email for user ${userId}; remainder code ${remainderCode} created without delivery`,
    )
  }

  return {
    issued: true,
    remainderCode,
    remainderValue,
    redeemBy,
    discountCodeId: created.id,
  }
}

/**
 * After a successful gift voucher PaymentIntent, create a one-time amount_off
 * DiscountCode and email it to the purchaser. Idempotent via sourcePaymentIntentId.
 */
import type { Payload } from 'payload'

import { addYearsIso } from '@/lib/stripe-connect/giftVoucherImport'
import { GIFT_VOUCHER_PURCHASE_TYPE } from '@/lib/stripe-connect/giftVoucherConstants'

export type IssuePurchasedGiftVoucherParams = {
  payload: Payload
  tenantId: number
  paymentIntentId: string
  amountEuros: number
  purchaserEmail: string
  purchaserName?: string | null
  userId?: number | null
}

export type IssuePurchasedGiftVoucherResult =
  | {
      issued: true
      code: string
      value: number
      redeemBy: string
      discountCodeId: number
    }
  | { issued: false; reason: string }

function generateGiftCode(): string {
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  return `GIFT${rand}`.slice(0, 24).padEnd(7, '0')
}

async function ensureUniqueGiftCode(payload: Payload, tenantId: number): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateGiftCode()
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
  const fallback = `GIFT${Date.now().toString(36).toUpperCase()}`.slice(0, 24)
  return fallback.padEnd(7, '0')
}

async function findExistingByPaymentIntent(
  payload: Payload,
  tenantId: number,
  paymentIntentId: string,
): Promise<{ id: number; code?: string | null; value?: number | null; redeemBy?: string | null } | null> {
  const existing = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { sourcePaymentIntentId: { equals: paymentIntentId } },
      ],
    },
  })
  return (existing.docs[0] as {
    id: number
    code?: string | null
    value?: number | null
    redeemBy?: string | null
  } | undefined) ?? null
}

export async function issuePurchasedGiftVoucher(
  params: IssuePurchasedGiftVoucherParams,
): Promise<IssuePurchasedGiftVoucherResult> {
  const {
    payload,
    tenantId,
    paymentIntentId,
    amountEuros,
    purchaserEmail,
    purchaserName,
  } = params

  const piId = typeof paymentIntentId === 'string' ? paymentIntentId.trim() : ''
  if (!piId) {
    return { issued: false, reason: 'missing_payment_intent_id' }
  }

  if (typeof amountEuros !== 'number' || !(amountEuros > 0)) {
    return { issued: false, reason: 'invalid_amount' }
  }

  const email = typeof purchaserEmail === 'string' ? purchaserEmail.trim() : ''
  if (!email) {
    return { issued: false, reason: 'missing_purchaser_email' }
  }

  const existing = await findExistingByPaymentIntent(payload, tenantId, piId)
  if (existing?.code) {
    return {
      issued: true,
      code: String(existing.code).toUpperCase(),
      value: typeof existing.value === 'number' ? existing.value : amountEuros,
      redeemBy: existing.redeemBy ? String(existing.redeemBy) : '',
      discountCodeId: existing.id,
    }
  }

  const now = new Date()
  const redeemBy = addYearsIso(now, 5)
  const code = await ensureUniqueGiftCode(payload, tenantId)
  const nameLabel =
    typeof purchaserName === 'string' && purchaserName.trim()
      ? `Gift voucher (${purchaserName.trim()})`
      : `Gift voucher (${email})`

  let created: { id: number; code?: string | null; value?: number | null; redeemBy?: string | null }
  try {
    created = (await payload.create({
      collection: 'discount-codes',
      data: {
        tenant: tenantId,
        name: nameLabel.slice(0, 120),
        code,
        type: 'amount_off',
        value: Number(amountEuros.toFixed(2)),
        currency: 'eur',
        duration: 'once',
        maxRedemptions: 1,
        rootPurchasedAt: now.toISOString(),
        redeemBy,
        sourcePaymentIntentId: piId,
        status: 'active',
      },
      overrideAccess: true,
      context: { tenant: tenantId },
    })) as typeof created
  } catch (err) {
    // Race: another webhook delivery may have created the same PI row
    const raced = await findExistingByPaymentIntent(payload, tenantId, piId)
    if (raced?.code) {
      return {
        issued: true,
        code: String(raced.code).toUpperCase(),
        value: typeof raced.value === 'number' ? raced.value : amountEuros,
        redeemBy: raced.redeemBy ? String(raced.redeemBy) : redeemBy,
        discountCodeId: raced.id,
      }
    }
    payload.logger?.error?.(
      `issuePurchasedGiftVoucher: create failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return { issued: false, reason: 'create_failed' }
  }

  const issuedCode = String(created.code ?? code).toUpperCase()
  const value =
    typeof created.value === 'number' ? created.value : Number(amountEuros.toFixed(2))
  const redeemByOut = created.redeemBy ? String(created.redeemBy) : redeemBy

  try {
    const expiryLabel = new Date(redeemByOut).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    await payload.sendEmail({
      to: email,
      subject: `Your gift voucher code: ${issuedCode}`,
      html: `
        <p>Hi${purchaserName ? ` ${String(purchaserName).trim()}` : ''},</p>
        <p>Thank you for your purchase. Here is your gift voucher code:</p>
        <p><strong>Code:</strong> ${issuedCode}<br/>
        <strong>Amount:</strong> €${value.toFixed(2)}<br/>
        <strong>Expires:</strong> ${expiryLabel}</p>
          <p>Enter this code at checkout on a drop-in, class pass, or membership purchase.</p>
      `,
    })
  } catch (emailErr) {
    payload.logger?.error?.(
      `issuePurchasedGiftVoucher: email failed for ${email}: ${
        emailErr instanceof Error ? emailErr.message : String(emailErr)
      }`,
    )
  }

  return {
    issued: true,
    code: issuedCode,
    value,
    redeemBy: redeemByOut,
    discountCodeId: created.id,
  }
}

/** Parse gift voucher purchase metadata from a PaymentIntent. */
export function parseGiftVoucherPurchaseMetadata(meta: Record<string, string>): {
  isGiftVoucher: boolean
  amountEuros: number
  purchaserEmail: string
  purchaserName: string
  userId: number | null
} {
  const isGiftVoucher = meta.type === GIFT_VOUCHER_PURCHASE_TYPE
  const amountEuros = Number(meta.amountEuros)
  const purchaserEmail = typeof meta.purchaserEmail === 'string' ? meta.purchaserEmail.trim() : ''
  const purchaserName = typeof meta.purchaserName === 'string' ? meta.purchaserName.trim() : ''
  const userIdRaw = meta.userId ? Number(meta.userId) : NaN
  const userId = Number.isFinite(userIdRaw) && userIdRaw > 0 ? userIdRaw : null
  return {
    isGiftVoucher,
    amountEuros: Number.isFinite(amountEuros) ? amountEuros : NaN,
    purchaserEmail,
    purchaserName,
    userId,
  }
}

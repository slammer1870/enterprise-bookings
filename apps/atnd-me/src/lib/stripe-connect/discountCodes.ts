import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'

export type TenantDiscountCode = {
  id: number
  code: string
  type: 'percentage_off' | 'amount_off'
  value: number
  currency?: string | null
  stripePromotionCodeId?: string | null
  maxRedemptions?: number | null
  timesRedeemed?: number | null
  redeemBy?: string | null
}

type DiscountCodeDoc = {
  id: number
  code?: string | null
  type?: TenantDiscountCode['type'] | null
  value?: number | null
  currency?: string | null
  stripePromotionCodeId?: string | null
  maxRedemptions?: number | null
  timesRedeemed?: number | null
  lastConsumedHoldId?: number | null
  redeemBy?: string | null
  status?: string | null
}

export type DiscountCodeCheckResult =
  | { ok: true; discount: TenantDiscountCode }
  | { ok: false; error: string }

export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase()
}

export function isDiscountCodeExpired(redeemBy?: string | null): boolean {
  if (!redeemBy) return false
  const ts = new Date(redeemBy).getTime()
  return Number.isFinite(ts) && ts <= Date.now()
}

export function isDiscountCodeExhausted(doc: {
  maxRedemptions?: number | null
  timesRedeemed?: number | null
}): boolean {
  if (doc.maxRedemptions == null) return false
  return (doc.timesRedeemed ?? 0) >= doc.maxRedemptions
}

function toTenantDiscountCode(doc: DiscountCodeDoc, normalizedCode: string): TenantDiscountCode {
  return {
    id: doc.id,
    code: String(doc.code ?? normalizedCode).trim().toUpperCase(),
    type: doc.type as TenantDiscountCode['type'],
    value: doc.value as number,
    currency: doc.currency ?? null,
    stripePromotionCodeId: doc.stripePromotionCodeId ?? null,
    maxRedemptions: doc.maxRedemptions ?? null,
    timesRedeemed: doc.timesRedeemed ?? 0,
    redeemBy: doc.redeemBy ?? null,
  }
}

/** Active tenant discount codes are matched case-insensitively (legacy rows may be lowercase). */
export async function findActiveTenantDiscountDocByCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<DiscountCodeDoc | undefined> {
  const normalizedCode = normalizeDiscountCode(discountCode)
  if (!normalizedCode) return undefined

  const match = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 0,
    overrideAccess: true,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { status: { equals: 'active' } },
      ],
    },
  })

  return match.docs.find(
    (doc) => normalizeDiscountCode(String((doc as DiscountCodeDoc).code ?? '')) === normalizedCode,
  ) as DiscountCodeDoc | undefined
}

async function findTenantDiscountDocByCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<DiscountCodeDoc | undefined> {
  const normalizedCode = normalizeDiscountCode(discountCode)
  if (!normalizedCode) return undefined

  const match = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 5,
    overrideAccess: true,
    where: {
      and: [{ tenant: { equals: tenantId } }, { code: { equals: normalizedCode } }],
    },
  })

  const exact = match.docs[0] as DiscountCodeDoc | undefined
  if (exact) return exact

  const legacy = await payload.find({
    collection: 'discount-codes',
    depth: 0,
    limit: 100,
    overrideAccess: true,
    where: {
      and: [{ tenant: { equals: tenantId } }],
    },
  })

  return legacy.docs.find(
    (doc) => normalizeDiscountCode(String((doc as DiscountCodeDoc).code ?? '')) === normalizedCode,
  ) as DiscountCodeDoc | undefined
}

/**
 * Resolve an active, still-redeemable tenant discount code.
 * Drop-ins apply discounts outside Stripe, so maxRedemptions is enforced via timesRedeemed.
 */
export async function resolveTenantDiscountCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<TenantDiscountCode | undefined> {
  const checked = await checkTenantDiscountCode(payload, tenantId, discountCode)
  return checked.ok ? checked.discount : undefined
}

export async function checkTenantDiscountCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<DiscountCodeCheckResult> {
  const code = normalizeDiscountCode(discountCode)
  if (!code) {
    return { ok: false, error: 'Invalid or inactive discount code.' }
  }

  const discountDoc = await findActiveTenantDiscountDocByCode(payload, tenantId, discountCode)
  if (!discountDoc?.type || typeof discountDoc.value !== 'number') {
    // Distinguish exhausted/archived one-shot codes for a clearer client message.
    const anyDoc = await findTenantDiscountDocByCode(payload, tenantId, discountCode)
    if (anyDoc && isDiscountCodeExhausted(anyDoc)) {
      return { ok: false, error: 'This discount code has already been used.' }
    }
    if (anyDoc && isDiscountCodeExpired(anyDoc.redeemBy)) {
      return { ok: false, error: 'This discount code has expired.' }
    }
    return { ok: false, error: 'Invalid or inactive discount code.' }
  }

  if (isDiscountCodeExpired(discountDoc.redeemBy)) {
    return { ok: false, error: 'This discount code has expired.' }
  }

  if (isDiscountCodeExhausted(discountDoc)) {
    return { ok: false, error: 'This discount code has already been used.' }
  }

  return { ok: true, discount: toTenantDiscountCode(discountDoc, code) }
}

export async function resolveTenantPromotionCodeId(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<string | undefined> {
  const discountDoc = await resolveTenantDiscountCode(payload, tenantId, discountCode)
  return discountDoc?.stripePromotionCodeId && String(discountDoc.stripePromotionCodeId).trim()
    ? String(discountDoc.stripePromotionCodeId).trim()
    : undefined
}

export async function validateTenantDiscountCode(
  payload: Payload,
  tenantId: number,
  discountCode: string,
): Promise<boolean> {
  const checked = await checkTenantDiscountCode(payload, tenantId, discountCode)
  return checked.ok
}

export type ConsumeDiscountCodeRedemptionResult =
  | { ok: true; timesRedeemed: number; archived: boolean; idempotent: boolean }
  | { ok: false; reason: string }

type DrizzleLike = {
  execute: (query: unknown) => Promise<unknown>
}

function getDrizzle(payload: Payload): DrizzleLike | null {
  const db = payload.db as { drizzle?: DrizzleLike } | undefined
  return db?.drizzle ?? null
}

/**
 * Atomically consume one redemption for a drop-in (idempotent per holdId).
 * Archives the code when timesRedeemed reaches maxRedemptions (and deactivates Stripe promo via hook).
 */
export async function consumeDiscountCodeRedemption(params: {
  payload: Payload
  tenantId: number
  discountCode: string
  holdId: number
}): Promise<ConsumeDiscountCodeRedemptionResult> {
  const { payload, tenantId, discountCode, holdId } = params
  const normalized = normalizeDiscountCode(discountCode)
  if (!normalized || !Number.isFinite(holdId)) {
    return { ok: false, reason: 'invalid_args' }
  }

  const doc = await findTenantDiscountDocByCode(payload, tenantId, normalized)
  if (!doc) {
    return { ok: false, reason: 'not_found' }
  }

  if (doc.lastConsumedHoldId != null && Number(doc.lastConsumedHoldId) === holdId) {
    return {
      ok: true,
      timesRedeemed: doc.timesRedeemed ?? 0,
      archived: doc.status === 'archived',
      idempotent: true,
    }
  }

  const drizzle = getDrizzle(payload)
  if (drizzle) {
    const result = (await drizzle.execute(sql`
      UPDATE "discount_codes"
      SET
        "times_redeemed" = CASE
          WHEN "last_consumed_hold_id" = ${holdId} THEN COALESCE("times_redeemed", 0)
          ELSE COALESCE("times_redeemed", 0) + 1
        END,
        "last_consumed_hold_id" = ${holdId},
        "updated_at" = NOW()
      WHERE "id" = ${doc.id}
        AND "tenant_id" = ${tenantId}
        AND (
          "last_consumed_hold_id" = ${holdId}
          OR (
            "status" = 'active'
            AND (
              "max_redemptions" IS NULL
              OR COALESCE("times_redeemed", 0) < "max_redemptions"
            )
          )
        )
      RETURNING "id", "times_redeemed", "max_redemptions", "status", "last_consumed_hold_id"
    `)) as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>

    const rows = Array.isArray(result) ? result : (result.rows ?? [])
    const row = rows[0]
    if (!row) {
      return { ok: false, reason: 'exhausted' }
    }

    const timesRedeemed = Number(row.times_redeemed ?? 0)
    const maxRedemptions =
      row.max_redemptions == null || row.max_redemptions === ''
        ? null
        : Number(row.max_redemptions)
    const shouldArchive =
      maxRedemptions != null && Number.isFinite(maxRedemptions) && timesRedeemed >= maxRedemptions

    if (shouldArchive && row.status === 'active') {
      await payload.update({
        collection: 'discount-codes',
        id: doc.id,
        data: { status: 'archived' },
        overrideAccess: true,
        context: { skipStripeSync: false },
      })
      return { ok: true, timesRedeemed, archived: true, idempotent: false }
    }

    return {
      ok: true,
      timesRedeemed,
      archived: row.status === 'archived',
      idempotent: Number(row.last_consumed_hold_id) === holdId && timesRedeemed === (doc.timesRedeemed ?? 0),
    }
  }

  // Fallback when drizzle is unavailable (unit tests): check-then-update.
  if (doc.status !== 'active') {
    return { ok: false, reason: 'inactive' }
  }
  if (isDiscountCodeExhausted(doc)) {
    return { ok: false, reason: 'exhausted' }
  }

  const nextTimes = (doc.timesRedeemed ?? 0) + 1
  const shouldArchive =
    doc.maxRedemptions != null && nextTimes >= doc.maxRedemptions

  await payload.update({
    collection: 'discount-codes',
    id: doc.id,
    data: {
      timesRedeemed: nextTimes,
      lastConsumedHoldId: holdId,
      ...(shouldArchive ? { status: 'archived' as const } : {}),
    },
    overrideAccess: true,
  })

  return { ok: true, timesRedeemed: nextTimes, archived: shouldArchive, idempotent: false }
}

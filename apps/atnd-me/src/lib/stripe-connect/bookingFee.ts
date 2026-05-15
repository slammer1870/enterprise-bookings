/**
 * Step 2.7.1 – Booking fee calculation: defaults, per-tenant overrides, optional bounds.
 */
import type { Payload } from 'payload'

/** Product types that map to fee-percent fields in platform-fees global. */
export type BookingFeeProductType = 'drop-in' | 'class-pass' | 'subscription'

/** Shape of platform-fees global (defaults + overrides + bounds). */
type PlatformFeesGlobal = {
  defaults?: {
    dropInPercent?: number
    classPassPercent?: number
    subscriptionPercent?: number
  }
  overrides?: Array<{
    tenant?: number | { id: number }
    dropInPercent?: number | null
    classPassPercent?: number | null
    subscriptionPercent?: number | null
  }>
  bounds?: {
    minCents?: number | null
    maxCents?: number | null
  }
}

const PRODUCT_FIELD_MAP: Record<BookingFeeProductType, keyof NonNullable<PlatformFeesGlobal['defaults']>> = {
  'drop-in': 'dropInPercent',
  'class-pass': 'classPassPercent',
  subscription: 'subscriptionPercent',
}

const DEFAULT_PERCENTS: Record<BookingFeeProductType, number> = {
  'drop-in': 2,
  'class-pass': 3,
  subscription: 4,
}

function resolvePercentFromConfig(
  global: PlatformFeesGlobal | null,
  tenantId: number,
  productType: BookingFeeProductType,
): number {
  const field = PRODUCT_FIELD_MAP[productType]
  const defaultPercent = global?.defaults?.[field] ?? DEFAULT_PERCENTS[productType]
  const override = global?.overrides?.find((o) => {
    const t = o.tenant
    if (typeof t === 'number') return t === tenantId
    if (typeof t === 'string') return /^\d+$/.test(t) && parseInt(t, 10) === tenantId
    if (typeof t === 'object' && t !== null && 'id' in t) {
      const id = (t as { id: unknown }).id
      if (typeof id === 'number' && Number.isFinite(id)) return id === tenantId
      if (typeof id === 'string' && /^\d+$/.test(id)) return parseInt(id, 10) === tenantId
    }
    return false
  })
  const overridePercent = override?.[field]
  if (overridePercent != null) {
    if (typeof overridePercent === 'number') return overridePercent
    if (typeof overridePercent === 'string' && /^\d+(\.\d+)?$/.test(overridePercent)) return Number(overridePercent)
  }
  // If defaults came back as a string (can happen across adapters/tests), coerce.
  if (typeof defaultPercent === 'string' && /^\d+(\.\d+)?$/.test(defaultPercent)) {
    return Number(defaultPercent)
  }
  return defaultPercent
}

/**
 * Resolves the effective booking fee percent for a tenant and product type.
 * Override (when present for that tenant) wins over default.
 */
export async function getEffectiveBookingFeePercent(params: {
  tenantId: number
  productType: BookingFeeProductType
  payload: Payload
}): Promise<number> {
  const { tenantId, productType, payload } = params
  const global = (await payload.findGlobal({
    slug: 'platform-fees',
    depth: 0,
  })) as PlatformFeesGlobal | null
  return resolvePercentFromConfig(global, tenantId, productType)
}

/**
 * Computes fee in cents: round(classPriceAmount * percent / 100), then clamp to optional bounds.
 * Never returns a negative value. Exported for unit tests.
 */
export function computeFeeCents(
  classPriceAmount: number,
  percent: number,
  bounds?: { minCents?: number | null; maxCents?: number | null } | null,
): number {
  let cents = Math.round((classPriceAmount * percent) / 100)
  if (cents < 0) cents = 0
  if (bounds?.minCents != null && typeof bounds.minCents === 'number' && cents < bounds.minCents) {
    cents = bounds.minCents
  }
  if (bounds?.maxCents != null && typeof bounds.maxCents === 'number' && cents > bounds.maxCents) {
    cents = bounds.maxCents
  }
  return cents
}

/**
 * Calculates booking fee amount in cents for a tenant and product type.
 * Uses platform-fees global (tenant override > default), rounds, then applies optional bounds.
 */
export async function calculateBookingFeeAmount(params: {
  tenantId: number
  productType: BookingFeeProductType
  classPriceAmount: number
  payload: Payload
}): Promise<number> {
  const { tenantId, productType, classPriceAmount, payload } = params
  const global = (await payload.findGlobal({
    slug: 'platform-fees',
    depth: 0,
  })) as PlatformFeesGlobal | null
  const percent = resolvePercentFromConfig(global, tenantId, productType)
  return computeFeeCents(classPriceAmount, percent, global?.bounds)
}

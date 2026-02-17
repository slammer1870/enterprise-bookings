/**
 * Phase 4.5 – Discount codes (Stripe Coupons + Promotion Codes) on tenant Connect account.
 * Tenant-scoped; create syncs to Stripe, archive deactivates promotion code.
 */
import type { CollectionConfig } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import {
  productsRequireStripeConnectRead,
  productsRequireStripeConnectCreate,
  productsRequireStripeConnectUpdate,
  productsRequireStripeConnectDelete,
  productsRequireStripeConnectAdmin,
} from '@/access/productsRequireStripeConnect'
import { createTenantCouponAndPromoCode, deactivateTenantPromotionCode } from '@/lib/stripe-connect/coupons'
import { getTenantStripeContext, type TenantStripeLike } from '@/lib/stripe-connect/tenantStripe'

async function getTenantForDoc(
  payload: import('payload').Payload,
  tenantId: number,
): Promise<(TenantStripeLike & { id: number }) | null> {
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })
  return tenant as (TenantStripeLike & { id: number }) | null
}

export const DiscountCodes: CollectionConfig = {
  slug: 'discount-codes',
  labels: { singular: 'Discount Code', plural: 'Discount Codes' },
  admin: {
    useAsTitle: 'code',
    group: 'Products',
    defaultColumns: ['name', 'code', 'type', 'value', 'status'],
    description: 'Promotion codes for customers (e.g. SUMMER20). Synced to Stripe on the tenant Connect account.',
  },
  access: {
    admin: productsRequireStripeConnectAdmin,
    read: productsRequireStripeConnectRead,
    create: productsRequireStripeConnectCreate,
    update: productsRequireStripeConnectUpdate,
    delete: productsRequireStripeConnectDelete,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Name',
      required: true,
      admin: { description: 'Admin label only (e.g. Summer 2025 – 20% off)' },
    },
    {
      name: 'code',
      type: 'text',
      label: 'Code',
      required: true,
      admin: { description: 'Customer-facing code (e.g. SUMMER20). Uppercase alphanumeric.' },
      validate: (val: unknown) => {
        if (!val || typeof val !== 'string') return 'Code is required'
        if (!/^[A-Z0-9]{3,24}$/i.test(val)) return 'Code must be 3–24 characters, letters and numbers only'
        return true
      },
    },
    {
      name: 'type',
      type: 'select',
      label: 'Discount type',
      required: true,
      options: [
        { label: 'Percentage off', value: 'percentage_off' },
        { label: 'Amount off', value: 'amount_off' },
      ],
    },
    {
      name: 'value',
      type: 'number',
      label: 'Value',
      required: true,
      admin: {
        description: 'For percentage: 1–100. For amount off: amount in cents (e.g. 500 = €5).',
      },
      validate: (val: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => {
        if (val == null) return 'Value is required'
        const t = siblingData?.type
        if (t === 'percentage_off' && (typeof val !== 'number' || val < 1 || val > 100)) return 'Percentage must be 1–100'
        if (t === 'amount_off' && (typeof val !== 'number' || val <= 0)) return 'Amount must be positive'
        return true
      },
    },
    {
      name: 'currency',
      type: 'text',
      label: 'Currency',
      admin: { description: 'Required for amount off (e.g. eur)', condition: (_: unknown, siblingData: Record<string, unknown> | undefined) => siblingData?.type === 'amount_off' },
      validate: (val: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => {
        if (siblingData?.type === 'amount_off' && (!val || typeof val !== 'string' || val.length !== 3)) return 'Currency is required (3 letters) for amount off'
        return true
      },
    },
    {
      name: 'duration',
      type: 'select',
      label: 'Duration',
      required: true,
      options: [
        { label: 'Once', value: 'once' },
        { label: 'Forever', value: 'forever' },
        { label: 'Repeating', value: 'repeating' },
      ],
    },
    {
      name: 'durationInMonths',
      type: 'number',
      label: 'Duration (months)',
      admin: { condition: (_: unknown, siblingData: Record<string, unknown> | undefined) => siblingData?.duration === 'repeating' },
      validate: (val: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => {
        if (siblingData?.duration === 'repeating' && (val == null || typeof val !== 'number' || val < 1)) return 'Required when duration is Repeating (min 1)'
        return true
      },
    },
    {
      name: 'maxRedemptions',
      type: 'number',
      label: 'Max redemptions',
      admin: { description: 'Leave empty for unlimited' },
    },
    {
      name: 'redeemBy',
      type: 'date',
      label: 'Redeem by',
      admin: { description: 'No redemptions after this date' },
    },
    {
      name: 'stripeCouponId',
      type: 'text',
      label: 'Stripe Coupon ID',
      admin: { readOnly: true, position: 'sidebar', description: 'Set after sync to Stripe' },
      access: { read: ({ req: { user } }) => checkRole(['admin', 'tenant-admin'], user as SharedUser) },
    },
    {
      name: 'stripePromotionCodeId',
      type: 'text',
      label: 'Stripe Promotion Code ID',
      admin: { readOnly: true, position: 'sidebar', description: 'Set after sync to Stripe' },
      access: { read: ({ req: { user } }) => checkRole(['admin', 'tenant-admin'], user as SharedUser) },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, req, previousDoc }) => {
        if (req.context?.skipStripeSync) return

        const tenantId = typeof doc.tenant === 'object' && doc.tenant != null ? (doc.tenant as { id: number }).id : doc.tenant
        if (tenantId == null) return

        const tenant = await getTenantForDoc(req.payload, tenantId)
        if (!tenant) return
        const ctx = getTenantStripeContext(tenant)
        if (!ctx.isConnected) return

        if (operation === 'create') {
          const type = doc.type as 'percentage_off' | 'amount_off'
          const duration = doc.duration as 'once' | 'repeating' | 'forever'
          const redeemBy = doc.redeemBy ? Math.floor(new Date(doc.redeemBy as string).getTime() / 1000) : undefined
          const { couponId, promotionCodeId } = await createTenantCouponAndPromoCode({
            tenant,
            code: String(doc.code).toUpperCase(),
            ...(type === 'percentage_off' ? { percent_off: Number(doc.value) } : { amount_off: Number(doc.value), currency: (doc.currency as string) || 'eur' }),
            duration,
            ...(duration === 'repeating' && doc.durationInMonths != null && { duration_in_months: Number(doc.durationInMonths) }),
            ...(doc.maxRedemptions != null && { max_redemptions: Number(doc.maxRedemptions) }),
            ...(redeemBy != null && { redeem_by: redeemBy }),
          })
          await req.payload.update({
            collection: 'discount-codes',
            id: doc.id,
            data: { stripeCouponId: couponId, stripePromotionCodeId: promotionCodeId },
            context: { skipStripeSync: true },
            req,
          })
          return
        }

        if (operation === 'update' && doc.status === 'archived' && previousDoc?.status !== 'archived') {
          const promoId = doc.stripePromotionCodeId ?? (previousDoc as Record<string, unknown>)?.stripePromotionCodeId
          if (promoId && typeof promoId === 'string') {
            await deactivateTenantPromotionCode(tenant, promoId)
          }
        }
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const doc = await req.payload.findByID({ collection: 'discount-codes', id, depth: 0 })
        if (!doc) return
        const tenantId = typeof doc.tenant === 'object' && doc.tenant != null ? (doc.tenant as { id: number }).id : doc.tenant
        const promoId = doc.stripePromotionCodeId
        if (tenantId == null || !promoId) return
        const tenant = await getTenantForDoc(req.payload, tenantId)
        if (!tenant) return
        const ctx = getTenantStripeContext(tenant)
        if (!ctx.isConnected) return
        await deactivateTenantPromotionCode(tenant, promoId)
      },
    ],
  },
}

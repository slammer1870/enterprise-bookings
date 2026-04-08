import type Stripe from 'stripe'
import type { Payload, PayloadRequest } from 'payload'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'

import { getPlatformStripe } from '@/lib/stripe/platform'
import { ensureStripeCustomerIdForAccount } from '@repo/bookings-payments'
import { getUserTenantIds } from '../../access/tenant-scoped'

function isAdmin(user: unknown): user is SharedUser {
  return checkRole(['admin'], user as SharedUser | null)
}

function isTenantAdmin(user: unknown): user is SharedUser {
  return checkRole(['tenant-admin'], user as SharedUser | null)
}

function assertCanAccessTenant(user: unknown, tenantId: number | null): void {
  if (!user) throw new Error('Unauthorized')
  if (isAdmin(user)) return
  if (!isTenantAdmin(user) || tenantId == null) throw new Error('Forbidden')

  const tenantIds = getUserTenantIds(user as SharedUser | null)
  if (tenantIds === null || tenantIds.includes(tenantId)) return
  throw new Error('Forbidden')
}

function getRelationshipId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return getRelationshipId((value as { id?: unknown }).id)
  }
  return null
}

function parseStripePriceId(priceJSON: unknown): string | null {
  if (typeof priceJSON === 'string' && priceJSON.trim()) {
    try {
      const parsed = JSON.parse(priceJSON) as { id?: unknown }
      return typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : null
    } catch {
      return null
    }
  }
  if (typeof priceJSON === 'object' && priceJSON !== null && 'id' in priceJSON) {
    const id = (priceJSON as { id?: unknown }).id
    return typeof id === 'string' && id.trim() ? id.trim() : null
  }
  return null
}

function stripeDateOnly(unix: number | null | undefined): string | null {
  if (unix == null) return null
  return new Date(unix * 1000).toISOString().slice(0, 10)
}

async function getStripeSubscriptionContext(
  req: PayloadRequest,
  subscriptionId: number | string,
): Promise<{
  payload: Payload
  subscription: Record<string, unknown>
  tenantId: number
  stripeAccountId: string
}> {
  const payload = req.payload as Payload
  const subscription = (await payload.findByID({
    collection: 'subscriptions' as any,
    id: subscriptionId,
    depth: 1,
    overrideAccess: true,
  })) as Record<string, unknown> | null

  if (!subscription) throw new Error('Subscription not found')

  const tenantId = getRelationshipId(subscription.tenant)
  assertCanAccessTenant(req.user, tenantId)
  if (tenantId == null) throw new Error('Subscription tenant is required')

  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown> | null

  const stripeAccountId =
    typeof tenant?.stripeConnectAccountId === 'string' && tenant.stripeConnectAccountId.trim()
      ? tenant.stripeConnectAccountId.trim()
      : null

  if (!stripeAccountId) throw new Error('Tenant does not have a connected Stripe account')

  return {
    payload,
    subscription,
    tenantId,
    stripeAccountId,
  }
}

export async function createStripeSubscriptionForDocument(
  req: PayloadRequest,
  subscriptionId: number | string,
): Promise<{
  stripeSubscriptionId: string
  status: string
}> {
  const { payload, subscription: existingSubscription, tenantId, stripeAccountId } =
    await getStripeSubscriptionContext(req, subscriptionId)
  if (typeof existingSubscription.stripeSubscriptionId === 'string' && existingSubscription.stripeSubscriptionId.trim()) {
    throw new Error('Subscription already exists in Stripe')
  }

  const userId = getRelationshipId(existingSubscription.user)
  if (userId == null) throw new Error('Subscription user is required')

  const user = (await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown> | null
  if (!user) throw new Error('User not found')

  const planId = getRelationshipId(existingSubscription.plan)
  if (planId == null) throw new Error('Subscription plan is required')

  const plan = (await payload.findByID({
    collection: 'plans',
    id: planId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown> | null
  if (!plan) throw new Error('Plan not found')

  const priceId = parseStripePriceId(plan.priceJSON)
  if (!priceId) throw new Error('Plan does not have a Stripe price ID')

  const stripe = getPlatformStripe()
  const { stripeCustomerId } = await ensureStripeCustomerIdForAccount({
    payload,
    userId,
    email: typeof user.email === 'string' ? user.email : null,
    name: typeof user.name === 'string' ? user.name : null,
    stripeAccountId,
  })

  const created = await stripe.subscriptions.create(
    {
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      metadata: { tenantId: String(tenantId) },
      expand: ['latest_invoice', 'customer'],
    },
    { stripeAccount: stripeAccountId },
  )

  await payload.update({
    collection: 'subscriptions' as any,
    id: subscriptionId,
    data: {
      stripeSubscriptionId: created.id,
      stripeAccountId,
      stripeCustomerId,
      status: created.status,
      startDate: stripeDateOnly(created.current_period_start),
      endDate: stripeDateOnly(created.current_period_end),
      cancelAt: stripeDateOnly(created.cancel_at),
    },
    context: { tenant: tenantId, skipStripeSync: true },
    overrideAccess: true,
  })

  return {
    stripeSubscriptionId: created.id,
    status: created.status,
  }
}

export async function updateStripeSubscriptionForDocument(
  req: PayloadRequest,
  subscriptionId: number | string,
  action: 'cancel_now' | 'cancel_at_period_end' | 'resume',
): Promise<{
  stripeSubscriptionId: string
  status: string
  cancelAt: string | null
}> {
  const { payload, subscription, tenantId, stripeAccountId } =
    await getStripeSubscriptionContext(req, subscriptionId)

  const stripeSubscriptionId =
    typeof subscription.stripeSubscriptionId === 'string' && subscription.stripeSubscriptionId.trim()
      ? subscription.stripeSubscriptionId.trim()
      : null
  if (!stripeSubscriptionId) throw new Error('Subscription is not linked to Stripe yet')

  const stripe = getPlatformStripe()
  const updated =
    action === 'cancel_now'
      ? await stripe.subscriptions.cancel(stripeSubscriptionId, {}, { stripeAccount: stripeAccountId })
      : await stripe.subscriptions.update(
          stripeSubscriptionId,
          {
            cancel_at_period_end: action === 'cancel_at_period_end',
          },
          { stripeAccount: stripeAccountId },
        )

  const canceledAt =
    typeof updated.canceled_at === 'number' ? updated.canceled_at : null
  const currentPeriodEnd =
    typeof updated.current_period_end === 'number' ? updated.current_period_end : null
  const endDateUnix = action === 'cancel_now' ? (canceledAt ?? currentPeriodEnd) : currentPeriodEnd

  await payload.update({
    collection: 'subscriptions' as any,
    id: subscriptionId,
    data: {
      status: updated.status,
      startDate: stripeDateOnly(updated.current_period_start),
      endDate: stripeDateOnly(endDateUnix),
      cancelAt: stripeDateOnly(updated.cancel_at ?? canceledAt),
    },
    context: { tenant: tenantId, skipStripeSync: true },
    overrideAccess: true,
  })

  return {
    stripeSubscriptionId,
    status: updated.status,
    cancelAt: stripeDateOnly(updated.cancel_at ?? canceledAt),
  }
}

function stripeDashboardBase(): string {
  return `https://dashboard.stripe.com/${process.env.NEXT_PUBLIC_STRIPE_IS_TEST_KEY ? 'test/' : ''}`
}

export async function getStripeDashboardLinkForDocument(params: {
  payload: Payload
  user: unknown
  collection: string
  id: number | string
  target: 'account' | 'customer' | 'product' | 'subscription' | 'promotion-code'
}): Promise<string | null> {
  const { payload, user, collection, id, target } = params

  const doc = (await payload.findByID({
    collection: collection as any,
    id,
    depth: 1,
    overrideAccess: true,
  }).catch(() => null)) as Record<string, unknown> | null

  if (!doc) return null

  const tenantId =
    collection === 'tenants'
      ? getRelationshipId(doc.id)
      : getRelationshipId(doc.tenant) ??
        getRelationshipId((doc as { registrationTenant?: unknown }).registrationTenant)

  if (collection === 'users' && !isAdmin(user)) {
    return null
  }
  if (collection !== 'users') {
    assertCanAccessTenant(user, tenantId)
  }

  const dashboardBase = stripeDashboardBase()

  if (target === 'account') {
    const accountId =
      typeof doc.stripeConnectAccountId === 'string' && doc.stripeConnectAccountId.trim()
        ? doc.stripeConnectAccountId.trim()
        : null
    return accountId ? `${dashboardBase}connect/accounts/${encodeURIComponent(accountId)}` : null
  }

  let objectId: string | null = null
  let stripeAccountId: string | null = null

  if (target === 'customer') {
    objectId =
      typeof doc.stripeCustomerId === 'string' && doc.stripeCustomerId.trim()
        ? doc.stripeCustomerId.trim()
        : null
  } else if (target === 'product') {
    objectId =
      typeof doc.stripeProductId === 'string' && doc.stripeProductId.trim()
        ? doc.stripeProductId.trim()
        : null
  } else if (target === 'subscription') {
    objectId =
      typeof doc.stripeSubscriptionId === 'string' && doc.stripeSubscriptionId.trim()
        ? doc.stripeSubscriptionId.trim()
        : null
    stripeAccountId =
      typeof doc.stripeAccountId === 'string' && doc.stripeAccountId.trim()
        ? doc.stripeAccountId.trim()
        : null
  } else if (target === 'promotion-code') {
    objectId =
      typeof doc.stripePromotionCodeId === 'string' && doc.stripePromotionCodeId.trim()
        ? doc.stripePromotionCodeId.trim()
        : null
  }

  if (!objectId) return null

  if (!stripeAccountId && tenantId != null) {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null)) as Record<string, unknown> | null
    stripeAccountId =
      typeof tenant?.stripeConnectAccountId === 'string' && tenant.stripeConnectAccountId.trim()
        ? tenant.stripeConnectAccountId.trim()
        : null
  }

  const accountQuery = stripeAccountId ? `?stripe_account=${encodeURIComponent(stripeAccountId)}` : ''

  switch (target) {
    case 'customer':
      return `${dashboardBase}customers/${encodeURIComponent(objectId)}${accountQuery}`
    case 'product':
      return `${dashboardBase}products/${encodeURIComponent(objectId)}${accountQuery}`
    case 'subscription':
      return `${dashboardBase}subscriptions/${encodeURIComponent(objectId)}${accountQuery}`
    case 'promotion-code':
      return `${dashboardBase}promotion-codes/${encodeURIComponent(objectId)}${accountQuery}`
    default:
      return null
  }
}

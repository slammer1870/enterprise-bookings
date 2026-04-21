/**
 * Step 3 / 7 – Booking access with payment validation.
 * Priority: Subscription > Class Pass > Drop-in. Requires tenant Connect when
 * payments enabled (drop-in) unless user has a valid class pass.
 */
import type { Access, AccessArgs } from 'payload'
import { createBookingAccess } from '@repo/bookings-plugin'
import { checkClassPass } from '@repo/bookings-payments'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getTenantFromTimeslot } from '@/utilities/getTenantFromTimeslot'
import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'
import { resolveTenantAdminTenantIds } from './tenant-scoped'

const { bookingCreateAccess, bookingUpdateAccess } = createBookingAccess(
  ATND_ME_BOOKINGS_COLLECTION_SLUGS,
)

type TenantLike = {
  id?: number
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: string | null
}

/** True if class option has any payment method attached (drop-in, plans, or class passes). */
function hasAnyPaymentMethod(eventType: unknown): boolean {
  if (!eventType || typeof eventType !== 'object') return false
  const pm = (eventType as {
    paymentMethods?: {
      allowedDropIn?: unknown
      allowedPlans?: unknown[] | null
      allowedClassPasses?: unknown[] | null
    }
  }).paymentMethods
  if (!pm) return false
  const hasDropIn = pm.allowedDropIn != null && (typeof pm.allowedDropIn === 'number' || (typeof pm.allowedDropIn === 'object' && pm.allowedDropIn !== null))
  const hasPlans = Array.isArray(pm.allowedPlans) && pm.allowedPlans.length > 0
  const hasClassPasses = Array.isArray(pm.allowedClassPasses) && pm.allowedClassPasses.length > 0
  return hasDropIn || hasPlans || hasClassPasses
}

function hasAllowedClassPasses(eventType: unknown): boolean {
  if (!eventType || typeof eventType !== 'object') return false
  const pm = (eventType as { paymentMethods?: { allowedClassPasses?: unknown[] | null } }).paymentMethods
  return Array.isArray(pm?.allowedClassPasses) && pm.allowedClassPasses.length > 0
}

function isTenantConnectActive(tenant: TenantLike): boolean {
  return (
    Boolean(tenant?.stripeConnectAccountId) &&
    tenant.stripeConnectOnboardingStatus === 'active'
  )
}

/**
 * Create access: run plugin logic, then payment validation.
 * If class option allows class passes and user has a valid pass, allow.
 * Else if payments enabled, require tenant Stripe Connect–active.
 */
export const bookingCreateAccessWithPaymentValidation: Access = async (args: AccessArgs) => {
  const { req, data } = args
  const user = req.user as SharedUser | null

  // Tenant org admins and staff manage bookings for their venues (admin UI).
  if (user && checkRole(['admin', 'staff'], user) && data?.timeslot) {
    const tenantIds = await resolveTenantAdminTenantIds({
      user,
      payload: req.payload,
      context: req.context as Record<string, unknown> | undefined,
    })
    if (tenantIds.length > 0) {
      const timeslotId = typeof data.timeslot === 'object' ? data.timeslot.id : data.timeslot
      if (timeslotId != null) {
        const timeslotTenantId = await getTenantFromTimeslot(req.payload, timeslotId as number)
        if (timeslotTenantId != null && tenantIds.includes(timeslotTenantId)) {
          return true
        }
      }
    }
  }

  const allowed = await bookingCreateAccess(args as Parameters<typeof bookingCreateAccess>[0])
  if (!allowed) return false

  if (!data?.timeslot) return true // no timeslot, no payment check

  const timeslotId = typeof data.timeslot === 'object' ? data.timeslot.id : data.timeslot
  if (timeslotId == null) return true

  try {
    const timeslot = await req.payload.findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.timeslots,
      id: timeslotId,
      depth: 2,
      context: { triggerAfterChange: false },
    })
    if (!timeslot) return true

    const eventType = timeslot.eventType
    const tenantId = await getTenantFromTimeslot(req.payload, timeslot as { id: number; tenant?: number | { id: number } })
    if (tenantId == null) return false

    if (user?.id && hasAllowedClassPasses(eventType)) {
      const result = await checkClassPass({
        payload: req.payload,
        user: { id: user.id as number },
        tenant: { id: tenantId },
        eventType: eventType as { paymentMethods?: { allowedClassPasses?: unknown[] | null } },
      })
      if (result.valid) return true
    }

    if (!hasAnyPaymentMethod(eventType)) return true

    const tenant = (await req.payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      select: {
        stripeConnectAccountId: true,
        stripeConnectOnboardingStatus: true,
      } as any,
    })) as TenantLike | null
    if (!tenant) return false

    return isTenantConnectActive(tenant)
  } catch {
    return false
  }
}

/**
 * Update access: use plugin logic (no extra payment check on update;
 * confirmations are driven by webhooks).
 */
export const bookingUpdateAccessWithPaymentValidation: Access = async (args: AccessArgs) => {
  const { req } = args
  const requester = req.user as SharedUser | null
  if (requester && checkRole(['admin', 'staff'], requester)) {
    const tenantIds = await resolveTenantAdminTenantIds({
      user: requester,
      payload: req.payload,
      context: req.context as Record<string, unknown> | undefined,
    })
    if (tenantIds.length === 0) return false
    return { tenant: { in: tenantIds } }
  }
  return bookingUpdateAccess(args as Parameters<typeof bookingUpdateAccess>[0])
}

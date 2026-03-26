/**
 * Step 3 / 7 – Booking access with payment validation.
 * Priority: Subscription > Class Pass > Drop-in. Requires tenant Connect when
 * payments enabled (drop-in) unless user has a valid class pass.
 */
import type { Access, AccessArgs } from 'payload'
import { bookingCreateAccess, bookingUpdateAccess } from '@repo/bookings-plugin'
import { checkClassPass } from '@repo/bookings-payments'
import { checkRole } from '@repo/shared-utils'
import type { User as SharedUser } from '@repo/shared-types'
import { getTenantFromLesson } from '@/utilities/getTenantFromLesson'
import { resolveTenantAdminTenantIds } from './tenant-scoped'

type TenantLike = {
  id?: number
  stripeConnectAccountId?: string | null
  stripeConnectOnboardingStatus?: string | null
}

/** True if class option has any payment method attached (drop-in, plans, or class passes). */
function hasAnyPaymentMethod(classOption: unknown): boolean {
  if (!classOption || typeof classOption !== 'object') return false
  const pm = (classOption as {
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

function hasAllowedClassPasses(classOption: unknown): boolean {
  if (!classOption || typeof classOption !== 'object') return false
  const pm = (classOption as { paymentMethods?: { allowedClassPasses?: unknown[] | null } }).paymentMethods
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

  // Tenant-admins manage bookings for their venues (admin UI): same as platform admin for
  // lesson capacity / payment gates; still scoped to the lesson's tenant.
  if (user && checkRole(['tenant-admin'], user) && data?.lesson) {
    const tenantIds = await resolveTenantAdminTenantIds({ user, payload: req.payload })
    if (tenantIds.length > 0) {
      const lessonId = typeof data.lesson === 'object' ? data.lesson.id : data.lesson
      if (lessonId != null) {
        const lessonTenantId = await getTenantFromLesson(req.payload, lessonId as number)
        if (lessonTenantId != null && tenantIds.includes(lessonTenantId)) {
          return true
        }
      }
    }
  }

  const allowed = await bookingCreateAccess(args as Parameters<typeof bookingCreateAccess>[0])
  if (!allowed) return false

  if (!data?.lesson) return true // no lesson, no payment check

  const lessonId = typeof data.lesson === 'object' ? data.lesson.id : data.lesson
  if (lessonId == null) return true

  try {
    const lesson = await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 2,
      context: { triggerAfterChange: false },
    })
    if (!lesson) return true

    const classOption = lesson.classOption
    const tenantId = await getTenantFromLesson(req.payload, lesson as { id: number; tenant?: number | { id: number } })
    if (tenantId == null) return false

    if (user?.id && hasAllowedClassPasses(classOption)) {
      const result = await checkClassPass({
        payload: req.payload,
        user: { id: user.id as number },
        tenant: { id: tenantId },
        classOption: classOption as { paymentMethods?: { allowedClassPasses?: unknown[] | null } },
      })
      if (result.valid) return true
    }

    if (!hasAnyPaymentMethod(classOption)) return true

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
  if (requester && checkRole(['tenant-admin'], requester)) {
    const tenantIds = await resolveTenantAdminTenantIds({ user: requester, payload: req.payload })
    if (tenantIds.length === 0) return false
    return { tenant: { in: tenantIds } }
  }
  return bookingUpdateAccess(args as Parameters<typeof bookingUpdateAccess>[0])
}

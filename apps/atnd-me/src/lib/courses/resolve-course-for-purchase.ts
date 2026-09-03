/**
 * Shared validation for auth + guest course purchase APIs.
 */

export type CourseForPurchase = {
  id: number
  status?: string | null
  maxEnrollments?: number | null
  priceInformation?: { price?: number | null } | null
  tenant?: number | { id?: number | null } | null
  startDate?: string | null
  endDate?: string | null
  durationLength?: number | null
  durationUnit?: 'days' | 'weeks' | null
}

export type ResolveCourseForPurchaseResult =
  | {
      ok: true
      course: CourseForPurchase
      priceCents: number
      tenantId: number
    }
  | { ok: false; status: number; error: string }

function toTenantId(tenant: CourseForPurchase['tenant']): number | null {
  if (typeof tenant === 'number' && Number.isFinite(tenant)) return tenant
  if (tenant && typeof tenant === 'object' && typeof tenant.id === 'number') return tenant.id
  return null
}

export function resolveCourseForPurchase(opts: {
  course: CourseForPurchase | null | undefined
  expectedTenantId: number
  activeEnrollmentCount: number
}): ResolveCourseForPurchaseResult {
  const { course, expectedTenantId, activeEnrollmentCount } = opts
  if (!course) {
    return { ok: false, status: 404, error: 'Course not found' }
  }

  const tenantId = toTenantId(course.tenant)
  if (tenantId == null || tenantId !== expectedTenantId) {
    return { ok: false, status: 404, error: 'Course not found' }
  }

  if (course.status !== 'open') {
    return { ok: false, status: 400, error: 'Course is not open for enrollment' }
  }

  const today = new Date().toISOString().slice(0, 10)
  if (course.startDate && course.startDate < today) {
    return { ok: false, status: 400, error: 'Course enrollment has closed' }
  }

  const priceEur = course.priceInformation?.price
  if (typeof priceEur !== 'number' || !(priceEur > 0)) {
    return { ok: false, status: 400, error: 'Course has no price configured' }
  }

  if (
    typeof course.maxEnrollments === 'number' &&
    course.maxEnrollments >= 1 &&
    activeEnrollmentCount >= course.maxEnrollments
  ) {
    return { ok: false, status: 400, error: 'Course is sold out' }
  }

  return {
    ok: true,
    course,
    priceCents: Math.round(priceEur * 100),
    tenantId,
  }
}

export function isCompleteGuestEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

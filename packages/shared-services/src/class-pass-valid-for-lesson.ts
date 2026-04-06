/**
 * Phase 4.6 – Pure filter: given a lesson and a list of class passes, return only passes valid for that lesson.
 * Used by getValidClassPassesForLesson and unit tests.
 */

export type LessonLike = {
  tenant?: number | { id: number } | null
  classOption?: {
    paymentMethods?: {
      allowedClassPasses?: Array<number | { id: number }> | null
    } | null
  } | null
}

export type ClassPassLike = {
  id?: number
  tenant?: number | { id: number } | null
  type?: number | { id: number } | null
  status?: string | null
  quantity?: number | null
  expirationDate?: string | null
}

function toId(val: number | { id: number } | null | undefined): number | null {
  if (val == null) return null
  if (typeof val === 'number') return val
  return (val as { id: number }).id ?? null
}

function toIdArray(val: unknown): number[] {
  if (!Array.isArray(val)) return []
  return val
    .map((v) => (typeof v === 'object' && v != null && 'id' in v ? (v as { id: number }).id : v))
    .filter((v): v is number => typeof v === 'number')
}

/**
 * Returns only class passes that are valid for the given lesson:
 * same tenant, type in lesson's allowedClassPasses, status active, quantity > 0, not expired.
 */
export function filterValidClassPassesForLesson(
  lesson: LessonLike,
  passes: ClassPassLike[],
  now: Date = new Date(),
  requiredQuantity = 1,
): ClassPassLike[] {
  const tenantId = toId(
    typeof lesson.tenant === 'object' && lesson.tenant != null ? lesson.tenant : (lesson.tenant as number)
  )
  const allowedTypeIds = toIdArray(lesson.classOption?.paymentMethods?.allowedClassPasses ?? [])
  if (allowedTypeIds.length === 0) return []
  const nowIso = now.toISOString()

  return passes.filter((pass) => {
    const passTenantId = toId(
      typeof pass.tenant === 'object' && pass.tenant != null ? pass.tenant : (pass.tenant as number)
    )
    const passTypeId = toId(typeof pass.type === 'object' && pass.type != null ? pass.type : (pass.type as number))
    if (tenantId != null && passTenantId !== tenantId) return false
    if (passTypeId == null || !allowedTypeIds.includes(passTypeId)) return false
    if (pass.status !== 'active') return false
    const q = pass.quantity ?? 0
    if (q < Math.max(1, requiredQuantity)) return false
    const exp = pass.expirationDate
    if (!exp || exp <= nowIso) return false
    return true
  })
}

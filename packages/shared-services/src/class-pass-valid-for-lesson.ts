/**
 * Pure filter: given a lesson and a list of class passes, return passes valid for that lesson.
 * A pass type allows the lesson when its allowedEventTypes contains the lesson event type.
 * Callers that have already resolved the product allow-list may still pass it on the lesson.
 */

import {
  creditsRemainingForEventType,
  relationId,
  relationIds,
  type EventTypeOverrideRow,
} from "./event-type-allowance"

export type TimeslotLike = {
  tenant?: number | { id: number } | null
  classOption?: {
    paymentMethods?: {
      allowedClassPasses?: Array<number | { id: number }> | null
    } | null
  } | null
  eventType?: {
    id?: number
    paymentMethods?: {
      allowedClassPasses?: Array<number | { id: number }> | null
    } | null
  } | null | number
}

export type ClassPassLike = {
  id?: number
  tenant?: number | { id: number } | null
  type?:
    | number
    | {
        id: number
        allowedEventTypes?: Array<number | { id: number }> | null
        maxBookingsPerTimeslot?: number | null
        name?: string | null
        eventTypeOverrides?: EventTypeOverrideRow[] | null
      }
    | null
  status?: string | null
  quantity?: number | null
  expirationDate?: string | null
  eventTypeOverrides?: Array<{
    eventType?: number | { id: number } | null
    quantity?: number | null
  }> | null
  creditsForEventType?: number
}

function lessonEventTypeId(lesson: TimeslotLike): number | null {
  const eventType = lesson.eventType
  if (typeof eventType === 'number') return eventType
  return relationId(eventType)
}

function passTypeAllowsLesson(pass: ClassPassLike, lesson: TimeslotLike): boolean {
  const eventTypeId = lessonEventTypeId(lesson)
  const type = pass.type
  if (type != null && typeof type === 'object' && Array.isArray(type.allowedEventTypes)) {
    return eventTypeId != null && relationIds(type.allowedEventTypes).includes(eventTypeId)
  }
  const typeId = relationId(type)
  const allowedIds = relationIds(
    (typeof lesson.eventType === 'object' && lesson.eventType != null
      ? lesson.eventType.paymentMethods?.allowedClassPasses
      : undefined) ?? lesson.classOption?.paymentMethods?.allowedClassPasses,
  )
  return typeId != null && allowedIds.includes(typeId)
}

function passMatchesLesson(
  pass: ClassPassLike,
  lesson: TimeslotLike,
  nowIso: string,
  statuses: readonly string[] = ['active'],
): boolean {
  const tenantId = relationId(lesson.tenant)
  const passTenantId = relationId(pass.tenant)
  if (tenantId != null && passTenantId !== tenantId) return false
  if (!passTypeAllowsLesson(pass, lesson)) return false
  if (!statuses.includes(pass.status ?? '')) return false
  const exp = pass.expirationDate
  if (!exp || exp <= nowIso) return false
  return true
}

/**
 * Annotates passes that match the lesson (tenant, allow-list, active, not expired)
 * with the credits remaining for this event type.
 */
export function annotateClassPassesForTimeslot(
  lesson: TimeslotLike,
  passes: ClassPassLike[],
  now: Date = new Date(),
): ClassPassLike[] {
  const nowIso = now.toISOString()
  const eventTypeId = lessonEventTypeId(lesson)
  return passes.flatMap((pass) => {
    if (!passMatchesLesson(pass, lesson, nowIso)) return []
    return [
      {
        ...pass,
        creditsForEventType: creditsRemainingForEventType(pass, eventTypeId),
      },
    ]
  })
}

export function filterValidClassPassesForTimeslot(
  lesson: TimeslotLike,
  passes: ClassPassLike[],
  now: Date = new Date(),
  requiredQuantity = 1,
): ClassPassLike[] {
  const needed = Math.max(1, requiredQuantity)
  return annotateClassPassesForTimeslot(lesson, passes, now).filter(
    (pass) => (pass.creditsForEventType ?? 0) >= needed,
  )
}

/**
 * Passes for the booking payment tab.
 * A pass that can cover the quantity is bookable.
 * A pass whose credits for this event type are already 0 is included so the tab
 * can say those credits are used. A pass with some credits, but not enough, stays hidden.
 */
export function classPassesForPaymentTab(
  lesson: TimeslotLike,
  passes: ClassPassLike[],
  now: Date = new Date(),
  requiredQuantity = 1,
): ClassPassLike[] {
  const nowIso = now.toISOString()
  const eventTypeId = lessonEventTypeId(lesson)
  const needed = Math.max(1, requiredQuantity)
  return passes.flatMap((pass) => {
    if (!passMatchesLesson(pass, lesson, nowIso, ['active', 'used'])) return []
    const credits = creditsRemainingForEventType(pass, eventTypeId)
    const bookable = pass.status === 'active' && credits >= needed
    if (!bookable && credits !== 0) return []
    return [{ ...pass, creditsForEventType: credits }]
  })
}

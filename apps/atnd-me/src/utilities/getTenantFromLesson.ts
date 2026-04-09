/**
 * Step 3 – Get tenant from lesson (for payment validation and tenant context).
 * Returns tenant id from a lesson doc or by loading the lesson by id.
 */
import type { Payload } from 'payload'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

type LessonLike = { id?: number; tenant?: number | { id: number } | null }

export async function getTenantFromLesson(
  payload: Payload,
  lessonOrLessonId: number | LessonLike,
): Promise<number | null> {
  let lesson: LessonLike | null = null
  if (typeof lessonOrLessonId === 'number') {
    const doc = await payload.findByID({
      collection: ATND_ME_BOOKINGS_COLLECTION_SLUGS.lessons,
      id: lessonOrLessonId,
      depth: 0,
      overrideAccess: true,
      context: { triggerAfterChange: false },
      select: { tenant: true } as any,
    })
    lesson = doc as LessonLike
  } else {
    lesson = lessonOrLessonId
  }
  if (!lesson) return null
  const raw = lesson.tenant
  if (raw == null) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'object' && raw !== null && 'id' in raw) return raw.id
  return null
}

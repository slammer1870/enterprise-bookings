import type { TaskHandler } from 'payload'
import { createGenerateLessonsFromScheduleHandler } from '@repo/bookings-plugin'

import { ATND_ME_BOOKINGS_COLLECTION_SLUGS } from '@/constants/bookings-collection-slugs'

/** Must match bookingsPlugin slugs — the package default handler targets `lessons`, not `timeslots`. */
const generateLessonsForAtndMe = createGenerateLessonsFromScheduleHandler(
  ATND_ME_BOOKINGS_COLLECTION_SLUGS,
)

/**
 * Wrapper for generateLessonsFromSchedule that ensures tenant context is set
 * This allows the job to find tenant-scoped lessons correctly
 */
export const generateLessonsFromScheduleWithTenant: TaskHandler<'generateLessonsFromSchedule'> = async (args) => {
  const { input, req } = args

  // Extract tenant from input (passed from scheduler document)
  const tenantId = (input as { tenant?: number }).tenant

  // Set tenant context in req so multi-tenant plugin filters queries correctly
  // This must be set before calling the original handler
  if (tenantId) {
    // Ensure req.context exists
    if (!req.context) {
      req.context = {}
    }
    req.context.tenant = tenantId
  }

  return generateLessonsForAtndMe(args)
}

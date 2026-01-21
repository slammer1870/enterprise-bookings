import type { TaskHandler } from 'payload'
import { generateLessonsFromSchedule } from '@repo/bookings-plugin/src/tasks/generate-lessons'

/**
 * Wrapper for generateLessonsFromSchedule that ensures tenant context is set
 * This allows the job to find tenant-scoped lessons correctly
 */
export const generateLessonsFromScheduleWithTenant: TaskHandler<'generateLessonsFromSchedule'> = async (args) => {
  const { input, req } = args
  
  // Extract tenant from input (passed from scheduler document)
  const tenantId = (input as any).tenant

  // Set tenant context in req so multi-tenant plugin filters queries correctly
  // This must be set before calling the original handler
  if (tenantId) {
    // Ensure req.context exists
    if (!req.context) {
      req.context = {}
    }
    req.context.tenant = tenantId
  }

  // Call the original task handler with updated req context
  // The multi-tenant plugin will automatically filter all queries by tenant
  // and set the tenant field on new documents
  return generateLessonsFromSchedule(args)
}

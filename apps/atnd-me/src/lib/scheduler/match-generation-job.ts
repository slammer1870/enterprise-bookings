import type { PayloadJob } from '@/payload-types'

function relationId(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return relationId((value as { id: unknown }).id)
  }
  return null
}

function idsMatch(left: unknown, right: unknown): boolean {
  const leftId = relationId(left)
  const rightId = relationId(right)
  if (leftId == null || rightId == null) return false
  return leftId === rightId
}

/** Prefer the in-flight or most recent generation job for a scheduler. */
export function resolveSchedulerGenerationJob(
  lastJob: PayloadJob | null | undefined,
  latestJob: PayloadJob | null | undefined,
): PayloadJob | null {
  if (!lastJob) return latestJob ?? null
  if (!latestJob) return lastJob

  const lastId = relationId(lastJob.id)
  const latestId = relationId(latestJob.id)
  if (lastId != null && lastId === latestId) return lastJob

  if (latestJob.processing) return latestJob
  if (lastJob.processing) return lastJob

  const lastCreated = Date.parse(lastJob.createdAt)
  const latestCreated = Date.parse(latestJob.createdAt)
  if (
    !Number.isNaN(latestCreated) &&
    !Number.isNaN(lastCreated) &&
    latestCreated >= lastCreated
  ) {
    return latestJob
  }

  return lastJob
}

export function jobInputMatchesScheduler(
  input: PayloadJob['input'],
  schedulerId: unknown,
  tenantId: unknown,
  branchId: unknown,
): boolean {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return false
  const record = input as Record<string, unknown>
  const inputSchedulerId = record.schedulerId
  const inputTenant = record.tenant
  const inputBranch = record.branch

  const schedulerMatches =
    schedulerId == null
      ? inputSchedulerId == null || inputSchedulerId === undefined
      : idsMatch(inputSchedulerId, schedulerId)

  if (!schedulerMatches) return false

  const tenantMatches =
    tenantId == null
      ? inputTenant == null
      : idsMatch(inputTenant, tenantId)

  if (!tenantMatches) return false

  if (branchId == null) {
    return inputBranch == null || inputBranch === undefined
  }

  if (inputBranch == null || inputBranch === undefined) {
    return true
  }

  return idsMatch(inputBranch, branchId)
}

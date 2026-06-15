import type { PayloadJob } from '@/payload-types'
import {
  formatTimeslotGenerationProgressMessage,
  generationProgressPercent,
  parseTimeslotGenerationProgress,
  type TimeslotGenerationProgress,
} from '@repo/bookings-plugin'

export type SchedulerGenerationJobStatus =
  | 'idle'
  | 'processing'
  | 'succeeded'
  | 'failed'

export type SchedulerGenerationStatusResponse = {
  jobId: number | null
  status: SchedulerGenerationJobStatus
  message?: string
  completedAt?: string | null
  updatedAt?: string | null
  totalTried?: number | null
  progress?: TimeslotGenerationProgress
  progressPercent?: number | null
}

export type { TimeslotGenerationProgress }

function relationId(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10)
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return relationId((value as { id: unknown }).id)
  }
  return null
}

function extractOutputMessage(job: PayloadJob): string | undefined {
  const log = job.log
  if (!Array.isArray(log)) return undefined

  for (let i = log.length - 1; i >= 0; i -= 1) {
    const entry = log[i]
    if (!entry || entry.taskSlug !== 'generateTimeslotsFromSchedule') continue
    const output = entry.output
    if (output && typeof output === 'object' && !Array.isArray(output)) {
      const message = (output as { message?: unknown }).message
      if (typeof message === 'string' && message.trim()) return message.trim()
    }
    if (entry.state === 'failed' && entry.error != null) {
      if (typeof entry.error === 'string') return entry.error
      if (entry.error instanceof Error) return entry.error.message
      try {
        return JSON.stringify(entry.error)
      } catch {
        return 'Generation failed'
      }
    }
  }

  if (job.hasError && job.error != null) {
    if (typeof job.error === 'string') return job.error
    if (job.error instanceof Error) return job.error.message
    try {
      return JSON.stringify(job.error)
    } catch {
      return 'Generation failed'
    }
  }

  return undefined
}

function buildStatusResponse(args: {
  job: PayloadJob
  status: SchedulerGenerationJobStatus
  message?: string
}): SchedulerGenerationStatusResponse {
  const { job, status, message } = args
  const jobId = relationId(job.id)
  const progress = parseTimeslotGenerationProgress(job.taskStatus)
  const progressPercent = generationProgressPercent(progress)
  const progressMessage =
    status === 'processing'
      ? formatTimeslotGenerationProgressMessage(progress)
      : undefined

  return {
    jobId,
    status,
    message: message ?? progressMessage,
    completedAt: job.completedAt ?? null,
    updatedAt: job.updatedAt ?? null,
    totalTried: job.totalTried ?? null,
    progress,
    progressPercent,
  }
}

export function parseGenerationJobStatus(job: PayloadJob | null | undefined): SchedulerGenerationStatusResponse {
  if (!job) {
    return { jobId: null, status: 'idle' }
  }

  const message = extractOutputMessage(job)

  if (job.processing) {
    return buildStatusResponse({
      job,
      status: 'processing',
      message: message ?? undefined,
    })
  }

  if (job.hasError) {
    return buildStatusResponse({
      job,
      status: 'failed',
      message: message ?? 'Timeslot generation failed',
    })
  }

  if (job.completedAt) {
    const succeeded =
      message == null ||
      /success/i.test(message) ||
      message.startsWith('Created ') ||
      message === 'Timeslots generated successfully'

    return buildStatusResponse({
      job,
      status: succeeded ? 'succeeded' : 'failed',
      message:
        message ??
        (succeeded ? 'Timeslots generated successfully' : 'Timeslot generation failed'),
    })
  }

  return buildStatusResponse({
    job,
    status: 'idle',
    message,
  })
}

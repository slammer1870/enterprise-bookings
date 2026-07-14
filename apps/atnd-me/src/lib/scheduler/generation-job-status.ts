import type { PayloadJob } from '@/payload-types'
import {
  computeWeightedGenerationPercent,
  estimateGenerationSecondsRemaining,
  formatGenerationTimeRemaining,
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
  estimatedSecondsRemaining?: number | null
  etaMessage?: string | null
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

function resolveProgress(args: {
  job: PayloadJob
  storedProgress?: unknown
}): TimeslotGenerationProgress | undefined {
  const fromJob = parseTimeslotGenerationProgress(args.job.taskStatus)
  if (fromJob) return fromJob

  // Legacy fallback for schedulers that still have stored progress on the document.
  return parseTimeslotGenerationProgress(args.storedProgress)
}

function buildStatusResponse(args: {
  job: PayloadJob
  status: SchedulerGenerationJobStatus
  message?: string
  storedProgress?: unknown
}): SchedulerGenerationStatusResponse {
  const { job, status, message, storedProgress } = args
  const jobId = relationId(job.id)
  const progress = resolveProgress({ job, storedProgress })
  const progressPercent =
    progress != null
      ? (generationProgressPercent(progress) ??
        computeWeightedGenerationPercent(progress))
      : status === 'processing'
        ? 2
        : null
  const estimatedSecondsRemaining =
    status === 'processing'
      ? estimateGenerationSecondsRemaining({
          percent: progressPercent,
          startedAt: progress?.startedAt ?? job.createdAt,
        })
      : null
  const progressMessage =
    status === 'processing'
      ? formatTimeslotGenerationProgressMessage(progress)
      : undefined

  return {
    jobId,
    status,
    message: message ?? progressMessage,
    completedAt: job.completedAt ?? null,
    updatedAt: progress?.updatedAt ?? job.updatedAt ?? null,
    totalTried: job.totalTried ?? null,
    progress,
    progressPercent,
    estimatedSecondsRemaining,
    etaMessage: formatGenerationTimeRemaining(estimatedSecondsRemaining),
  }
}

export function buildSchedulerGenerationStatus(args: {
  lastGenerationJobId?: number | null
  generationProgress?: unknown
  job: PayloadJob | null
}): SchedulerGenerationStatusResponse {
  const { lastGenerationJobId, generationProgress, job } = args
  const parsedStored = parseTimeslotGenerationProgress(generationProgress)
  const storedJobId =
    lastGenerationJobId != null && Number.isFinite(lastGenerationJobId)
      ? lastGenerationJobId
      : null

  if (parsedStored) {
    const fromStored = parseGenerationJobStatus(null, { storedProgress: generationProgress })
    return {
      ...fromStored,
      jobId: storedJobId ?? fromStored.jobId,
    }
  }

  const fromJob = parseGenerationJobStatus(job, { storedProgress: generationProgress })
  return {
    ...fromJob,
    jobId: fromJob.jobId ?? storedJobId,
  }
}

export function parseGenerationJobStatus(
  job: PayloadJob | null | undefined,
  options?: { storedProgress?: unknown },
): SchedulerGenerationStatusResponse {
  let resolvedJob = job
  const storedProgress = options?.storedProgress
  const parsedStoredProgress = parseTimeslotGenerationProgress(storedProgress)

  if (
    resolvedJob &&
    parsedStoredProgress &&
    parsedStoredProgress.phase !== 'done' &&
    resolvedJob.completedAt
  ) {
    const storedAt = parsedStoredProgress.updatedAt
      ? Date.parse(parsedStoredProgress.updatedAt)
      : 0
    const completedAt = Date.parse(resolvedJob.completedAt)
    if (
      !Number.isNaN(storedAt) &&
      !Number.isNaN(completedAt) &&
      storedAt > completedAt
    ) {
      resolvedJob = null
    }
  }

  if (!resolvedJob) {
    if (parsedStoredProgress) {
      const status: SchedulerGenerationStatusResponse['status'] =
        parsedStoredProgress.phase === 'done' ? 'succeeded' : 'processing'

      const estimatedSecondsRemaining =
        status === 'processing'
          ? estimateGenerationSecondsRemaining({
              percent: generationProgressPercent(parsedStoredProgress) ??
                computeWeightedGenerationPercent(parsedStoredProgress) ??
                2,
              startedAt: parsedStoredProgress.startedAt ?? new Date().toISOString(),
            })
          : null

      return {
        jobId: null,
        status,
        message:
          status === 'processing'
            ? formatTimeslotGenerationProgressMessage(parsedStoredProgress)
            : 'Generation complete',
        completedAt: null,
        updatedAt: parsedStoredProgress.updatedAt ?? null,
        totalTried: null,
        progress: parsedStoredProgress,
        progressPercent:
          status === 'processing'
            ? Math.min(
                100,
                Math.max(
                  generationProgressPercent(parsedStoredProgress) ??
                    computeWeightedGenerationPercent(parsedStoredProgress) ??
                    2,
                  2,
                ),
              )
            : 100,
        estimatedSecondsRemaining,
        etaMessage: formatGenerationTimeRemaining(estimatedSecondsRemaining),
      }
    }

    return { jobId: null, status: 'idle' }
  }

  const message = extractOutputMessage(resolvedJob)

  if (resolvedJob.processing) {
    return buildStatusResponse({
      job: resolvedJob,
      status: 'processing',
      message: message ?? undefined,
      storedProgress: options?.storedProgress,
    })
  }

  if (resolvedJob.hasError) {
    return buildStatusResponse({
      job: resolvedJob,
      status: 'failed',
      message: message ?? 'Timeslot generation failed',
      storedProgress: options?.storedProgress,
    })
  }

  if (resolvedJob.completedAt) {
    const succeeded =
      message == null ||
      /success/i.test(message) ||
      message.startsWith('Created ') ||
      message === 'Timeslots generated successfully'

    return buildStatusResponse({
      job: resolvedJob,
      status: succeeded ? 'succeeded' : 'failed',
      message:
        message ??
        (succeeded ? 'Timeslots generated successfully' : 'Timeslot generation failed'),
      storedProgress: options?.storedProgress,
    })
  }

  return buildStatusResponse({
    job: resolvedJob,
    status: 'idle',
    message,
    storedProgress: options?.storedProgress,
  })
}

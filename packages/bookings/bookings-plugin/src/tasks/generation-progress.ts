import type { CollectionSlug, Payload, PayloadRequest } from "payload";

export type TimeslotGenerationPhase =
  | "clearing"
  | "planning"
  | "creating"
  | "done";

export type TimeslotGenerationProgress = {
  phase: TimeslotGenerationPhase;
  created?: number;
  cleared?: number;
  total?: number;
  skipped?: number;
  daysProcessed?: number;
  daysTotal?: number;
  percent?: number;
  startedAt?: string;
  updatedAt?: string;
};

const PAYLOAD_JOBS_SLUG = "payload-jobs" as CollectionSlug;
const PROGRESS_UPDATE_INTERVAL_MS = 2000;

function toJobId(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return parseInt(value, 10);
  return null;
}

export function resolveGenerationJobId(req: PayloadRequest): number | null {
  return toJobId(req.context?.generationJobId);
}

export function hasPayloadJobsCollection(payload: Payload): boolean {
  return Boolean(payload.collections && "payload-jobs" in payload.collections);
}

export class GenerationProgressReporter {
  private lastWriteAt = 0;
  private startedAt: string | null = null;
  private readonly payload: Payload;
  private readonly req: PayloadRequest;
  private readonly jobId: number | null;
  private readonly schedulerId: number | null;
  private readonly schedulerCollection: CollectionSlug | null;

  constructor(
    payload: Payload,
    req: PayloadRequest,
    jobId: number | null,
    schedulerId: number | null = null,
    schedulerCollection: CollectionSlug | null = null,
  ) {
    this.payload = payload;
    this.req = req;
    this.jobId = jobId;
    this.schedulerId = schedulerId;
    this.schedulerCollection =
      schedulerCollection &&
      payload.collections &&
      schedulerCollection in payload.collections
        ? schedulerCollection
        : schedulerId != null &&
            payload.collections &&
            "scheduler" in payload.collections
          ? ("scheduler" as CollectionSlug)
          : null;
  }

  private enrichProgress(
    progress: TimeslotGenerationProgress,
  ): TimeslotGenerationProgress {
    const now = new Date().toISOString();
    if (!this.startedAt) {
      this.startedAt = progress.startedAt ?? now;
    }
    const percent = computeWeightedGenerationPercent(progress) ?? 0;
    return {
      ...progress,
      percent,
      startedAt: this.startedAt,
      updatedAt: now,
    };
  }

  private async persistProgress(
    progress: TimeslotGenerationProgress,
  ): Promise<void> {
    if (this.jobId != null && hasPayloadJobsCollection(this.payload)) {
      try {
        await this.payload.update({
          collection: PAYLOAD_JOBS_SLUG,
          id: this.jobId,
          data: {
            taskStatus: progress,
          },
          context: { triggerAfterChange: false },
          overrideAccess: true,
          req: this.req,
        });
      } catch {
        // Best-effort — scheduler document is the primary progress store.
      }
    }

    if (this.schedulerId != null && this.schedulerCollection != null) {
      try {
        await this.payload.update({
          collection: this.schedulerCollection,
          id: this.schedulerId,
          data: {
            generationProgress: progress,
          } as Record<string, unknown>,
          context: { triggerAfterChange: false, skipSchedulerGeneration: true },
          overrideAccess: true,
          req: this.req,
        });
      } catch {
        // Progress updates must not fail generation.
      }
    }
  }

  async report(
    progress: TimeslotGenerationProgress,
    options?: { force?: boolean },
  ): Promise<void> {
    if (this.jobId == null && this.schedulerId == null) {
      return;
    }

    const now = Date.now();
    if (!options?.force && now - this.lastWriteAt < PROGRESS_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastWriteAt = now;

    await this.persistProgress(this.enrichProgress(progress));
  }
}

export function parseTimeslotGenerationProgress(
  taskStatus: unknown,
): TimeslotGenerationProgress | undefined {
  if (taskStatus == null || typeof taskStatus !== "object" || Array.isArray(taskStatus)) {
    return undefined;
  }

  const record = taskStatus as Record<string, unknown>;
  const phase = record.phase;
  if (
    phase !== "clearing" &&
    phase !== "planning" &&
    phase !== "creating" &&
    phase !== "done"
  ) {
    return undefined;
  }

  const toCount = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return undefined;
  };

  return {
    phase,
    created: toCount(record.created),
    cleared: toCount(record.cleared),
    total: toCount(record.total),
    skipped: toCount(record.skipped),
    daysProcessed: toCount(record.daysProcessed),
    daysTotal: toCount(record.daysTotal),
    percent: toCount(record.percent),
    startedAt:
      typeof record.startedAt === "string" ? record.startedAt : undefined,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

export function formatTimeslotGenerationProgressMessage(
  progress: TimeslotGenerationProgress | undefined,
  fallback = "Generating timeslots…",
): string {
  if (!progress) return fallback;

  switch (progress.phase) {
    case "clearing":
      if (
        progress.total != null &&
        progress.cleared != null &&
        progress.total > 0
      ) {
        return `Clearing existing timeslots… ${progress.cleared.toLocaleString()} / ${progress.total.toLocaleString()}`;
      }
      return "Clearing existing timeslots…";
    case "planning":
      if (
        progress.daysTotal != null &&
        progress.daysProcessed != null &&
        progress.daysTotal > 0
      ) {
        return `Planning timeslots… (day ${progress.daysProcessed} of ${progress.daysTotal})`;
      }
      return "Planning timeslots…";
    case "creating":
      if (progress.total != null && progress.created != null && progress.total > 0) {
        return `Creating timeslots… ${progress.created.toLocaleString()} / ${progress.total.toLocaleString()}`;
      }
      return "Creating timeslots…";
    case "done":
      return fallback;
    default:
      return fallback;
  }
}

export function computeWeightedGenerationPercent(
  progress: TimeslotGenerationProgress | undefined,
): number | null {
  if (!progress) return null;

  switch (progress.phase) {
    case "clearing":
      if (
        progress.total != null &&
        progress.cleared != null &&
        progress.total > 0
      ) {
        const clearingRatio = progress.cleared / progress.total;
        return Math.min(35, Math.round(3 + clearingRatio * 32));
      }
      return 3;
    case "planning":
      if (
        progress.daysTotal != null &&
        progress.daysProcessed != null &&
        progress.daysTotal > 0
      ) {
        const planningRatio = progress.daysProcessed / progress.daysTotal;
        return Math.min(35, Math.round(5 + planningRatio * 30));
      }
      return 8;
    case "creating":
      if (
        progress.total != null &&
        progress.created != null &&
        progress.total > 0
      ) {
        const creatingRatio = progress.created / progress.total;
        return Math.min(100, Math.round(35 + creatingRatio * 65));
      }
      return 40;
    case "done":
      return 100;
    default:
      return null;
  }
}

export function estimateGenerationSecondsRemaining(args: {
  percent: number | null | undefined;
  startedAt?: string | null;
}): number | null {
  const { percent, startedAt } = args;
  if (percent == null || percent <= 0 || percent >= 100) return null;

  const remainingPercent = 100 - percent;
  if (remainingPercent <= 0) return null;

  if (!startedAt) return null;

  const startedMs = new Date(startedAt).getTime();
  const endMs = Date.now();
  if (
    Number.isNaN(startedMs) ||
    endMs <= startedMs ||
    percent <= 0
  ) {
    return null;
  }

  const totalElapsedMs = endMs - startedMs;
  const estimatedMs = (remainingPercent / percent) * totalElapsedMs;

  if (!Number.isFinite(estimatedMs) || estimatedMs <= 0) {
    return null;
  }
  return Math.max(1, Math.round(estimatedMs / 1000));
}

export function formatGenerationTimeRemaining(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 45) return `About ${seconds} seconds remaining`;
  if (seconds < 90) return "About 1 minute remaining";
  if (seconds < 3600) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `About ${minutes} minute${minutes === 1 ? "" : "s"} remaining`;
  }
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `About ${hours} hour${hours === 1 ? "" : "s"} remaining`;
}

/** @deprecated Use computeWeightedGenerationPercent */
export function generationProgressPercent(
  progress: TimeslotGenerationProgress | undefined,
): number | null {
  if (
    progress &&
    typeof progress.percent === "number" &&
    Number.isFinite(progress.percent) &&
    progress.percent > 0
  ) {
    return Math.min(100, Math.max(0, Math.round(progress.percent)));
  }
  return computeWeightedGenerationPercent(progress);
}

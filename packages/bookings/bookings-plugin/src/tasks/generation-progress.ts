import type { CollectionSlug, Payload, PayloadRequest } from "payload";

export type TimeslotGenerationPhase =
  | "clearing"
  | "planning"
  | "creating"
  | "done";

export type TimeslotGenerationProgress = {
  phase: TimeslotGenerationPhase;
  created?: number;
  total?: number;
  skipped?: number;
  daysProcessed?: number;
  daysTotal?: number;
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
  private readonly payload: Payload;
  private readonly req: PayloadRequest;
  private readonly jobId: number | null;

  constructor(payload: Payload, req: PayloadRequest, jobId: number | null) {
    this.payload = payload;
    this.req = req;
    this.jobId = jobId;
  }

  async report(
    progress: TimeslotGenerationProgress,
    options?: { force?: boolean },
  ): Promise<void> {
    if (this.jobId == null || !hasPayloadJobsCollection(this.payload)) {
      return;
    }

    const now = Date.now();
    if (!options?.force && now - this.lastWriteAt < PROGRESS_UPDATE_INTERVAL_MS) {
      return;
    }
    this.lastWriteAt = now;

    try {
      await this.payload.update({
        collection: PAYLOAD_JOBS_SLUG,
        id: this.jobId,
        data: {
          taskStatus: {
            ...progress,
            updatedAt: new Date().toISOString(),
          },
        },
        context: { triggerAfterChange: false },
        overrideAccess: true,
        req: this.req,
      });
    } catch {
      // Progress updates are best-effort and must not fail generation.
    }
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
    total: toCount(record.total),
    skipped: toCount(record.skipped),
    daysProcessed: toCount(record.daysProcessed),
    daysTotal: toCount(record.daysTotal),
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

export function generationProgressPercent(
  progress: TimeslotGenerationProgress | undefined,
): number | null {
  if (!progress) return null;

  if (
    progress.phase === "creating" &&
    progress.total != null &&
    progress.created != null &&
    progress.total > 0
  ) {
    return Math.min(100, Math.round((progress.created / progress.total) * 100));
  }

  if (
    progress.phase === "planning" &&
    progress.daysTotal != null &&
    progress.daysProcessed != null &&
    progress.daysTotal > 0
  ) {
    return Math.min(
      100,
      Math.round((progress.daysProcessed / progress.daysTotal) * 100),
    );
  }

  if (progress.phase === "clearing") {
    return null;
  }

  return null;
}

import { describe, expect, it, vi } from "vitest";

import {
  computeWeightedGenerationPercent,
  estimateGenerationSecondsRemaining,
  formatGenerationTimeRemaining,
  formatTimeslotGenerationProgressMessage,
  GenerationProgressReporter,
  generationProgressPercent,
  parseTimeslotGenerationProgress,
  resolveGenerationJobId,
} from "../src/tasks/generation-progress";

describe("generation progress helpers", () => {
  it("parses taskStatus progress payloads", () => {
    expect(
      parseTimeslotGenerationProgress({
        phase: "creating",
        created: 50,
        total: 200,
        skipped: 4,
        percent: 52,
        startedAt: "2026-06-15T12:00:00.000Z",
      }),
    ).toEqual({
      phase: "creating",
      created: 50,
      total: 200,
      skipped: 4,
      daysProcessed: undefined,
      daysTotal: undefined,
      percent: 52,
      startedAt: "2026-06-15T12:00:00.000Z",
      updatedAt: undefined,
    });
  });

  it("formats creating progress messages", () => {
    expect(
      formatTimeslotGenerationProgressMessage({
        phase: "creating",
        created: 500,
        total: 2000,
      }),
    ).toBe("Creating timeslots… 500 / 2,000");
  });

  it("computes weighted percent across phases", () => {
    expect(
      computeWeightedGenerationPercent({
        phase: "creating",
        created: 250,
        total: 1000,
      }),
    ).toBe(51);

    expect(
      computeWeightedGenerationPercent({
        phase: "planning",
        daysProcessed: 30,
        daysTotal: 120,
      }),
    ).toBe(13);

    expect(
      computeWeightedGenerationPercent({
        phase: "clearing",
      }),
    ).toBe(3);

    expect(
      computeWeightedGenerationPercent({
        phase: "clearing",
        cleared: 500,
        total: 1000,
      }),
    ).toBe(19);
  });

  it("formats clearing progress messages", () => {
    expect(
      formatTimeslotGenerationProgressMessage({
        phase: "clearing",
        cleared: 250,
        total: 1000,
      }),
    ).toBe("Clearing existing timeslots… 250 / 1,000");
  });

  it("prefers stored percent when present", () => {
    expect(
      generationProgressPercent({
        phase: "creating",
        created: 1,
        total: 100,
        percent: 77,
      }),
    ).toBe(77);
  });

  it("estimates remaining time from progress rate", () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    const seconds = estimateGenerationSecondsRemaining({
      percent: 25,
      startedAt,
    });
    expect(seconds).not.toBeNull();
    expect(seconds!).toBeGreaterThan(60);
  });

  it("formats eta messages", () => {
    expect(formatGenerationTimeRemaining(30)).toBe("About 30 seconds remaining");
    expect(formatGenerationTimeRemaining(120)).toBe("About 2 minutes remaining");
  });

  it("resolves job id from req context or job document", () => {
    expect(resolveGenerationJobId({ context: { generationJobId: 12 } } as never)).toBe(12);
    expect(resolveGenerationJobId({ context: {} } as never, 34)).toBe(34);
    expect(resolveGenerationJobId({ context: { generationJobId: 12 } } as never, 34)).toBe(12);
  });

  it("persists progress on the scheduler collection", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const payload = {
      collections: { scheduler: {} },
      update,
    } as never;
    const req = { context: {} } as never;

    const reporter = new GenerationProgressReporter(payload, req, 99, 10);
    await reporter.report(
      {
        phase: "creating",
        created: 5,
        total: 20,
      },
      { force: true },
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: "scheduler",
        id: 10,
        data: expect.objectContaining({
          generationProgress: expect.objectContaining({
            phase: "creating",
            created: 5,
            total: 20,
          }),
          lastGenerationJobId: 99,
        }),
        context: {
          skipSchedulerGeneration: true,
        },
        overrideAccess: true,
        req,
      }),
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  computeWeightedGenerationPercent,
  estimateGenerationSecondsRemaining,
  formatGenerationTimeRemaining,
  formatTimeslotGenerationProgressMessage,
  generationProgressPercent,
  parseTimeslotGenerationProgress,
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
    const updatedAt = new Date().toISOString();
    const seconds = estimateGenerationSecondsRemaining({
      percent: 25,
      startedAt,
      updatedAt,
    });
    expect(seconds).not.toBeNull();
    expect(seconds!).toBeGreaterThan(60);
  });

  it("formats eta messages", () => {
    expect(formatGenerationTimeRemaining(30)).toBe("About 30 seconds remaining");
    expect(formatGenerationTimeRemaining(120)).toBe("About 2 minutes remaining");
  });
});

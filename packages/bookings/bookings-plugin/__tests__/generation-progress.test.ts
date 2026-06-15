import { describe, expect, it } from "vitest";

import {
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
      }),
    ).toEqual({
      phase: "creating",
      created: 50,
      total: 200,
      skipped: 4,
      daysProcessed: undefined,
      daysTotal: undefined,
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

  it("computes percent complete for creating and planning phases", () => {
    expect(
      generationProgressPercent({
        phase: "creating",
        created: 250,
        total: 1000,
      }),
    ).toBe(25);

    expect(
      generationProgressPercent({
        phase: "planning",
        daysProcessed: 30,
        daysTotal: 120,
      }),
    ).toBe(25);
  });
});

import { describe, it, expect } from "vitest";

import { classPassTypesCollection } from "../src/class-pass/collections/class-pass-types";
import { generatePlansCollection } from "../src/membership/collections/plans";
import { dropInsCollection } from "../src/payments/collections/drop-ins";

describe("maxBookingsPerTimeslot beforeValidate", () => {
  it("class-pass: numeric max should win over legacy allowMultiple boolean", async () => {
    const cfg = classPassTypesCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        allowMultipleBookingsPerTimeslot: true,
        maxBookingsPerTimeslot: 3,
      },
    } as any);

    expect((data as any).maxBookingsPerTimeslot).toBe(3);
  });

  it("class-pass: legacy allowMultiple should set null when numeric field missing", async () => {
    const cfg = classPassTypesCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        allowMultipleBookingsPerTimeslot: true,
      },
    } as any);

    expect((data as any).maxBookingsPerTimeslot).toBe(null);
  });

  it("plans: numeric max should win over legacy allowMultiple boolean", async () => {
    const cfg = generatePlansCollection({} as any);
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        sessionsInformation: {
          allowMultipleBookingsPerTimeslot: true,
          maxBookingsPerTimeslot: 4,
        },
      },
    } as any);

    expect((data as any).sessionsInformation.maxBookingsPerTimeslot).toBe(4);
  });

  it("drop-ins: numeric max should win over legacy adjustable boolean", async () => {
    const cfg = dropInsCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        adjustable: true,
        maxBookingsPerTimeslot: 5,
      },
    } as any);

    expect((data as any).maxBookingsPerTimeslot).toBe(5);
    expect((data as any).adjustable).toBe(false);
  });

  it("drop-ins: explicit max of 1 should not be cleared when adjustable is true", async () => {
    const cfg = dropInsCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        adjustable: true,
        maxBookingsPerTimeslot: 1,
      },
    } as any);

    expect((data as any).maxBookingsPerTimeslot).toBe(1);
    expect((data as any).adjustable).toBe(false);
  });

  it("drop-ins: legacy adjustable should set null when numeric field missing", async () => {
    const cfg = dropInsCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        adjustable: true,
      },
    } as any);

    expect((data as any).maxBookingsPerTimeslot).toBe(null);
  });
});


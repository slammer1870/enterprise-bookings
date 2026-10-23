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

  it("class-pass: an override event type is added to Allowed and the row stays", async () => {
    const cfg = classPassTypesCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        allowedEventTypes: [1],
        quantity: 10,
        eventTypeOverrides: [{ eventType: 2, quantity: 4 }],
      },
    } as any);

    expect((data as any).allowedEventTypes).toEqual([1, 2]);
    expect((data as any).eventTypeOverrides).toEqual([{ eventType: 2, quantity: 4 }]);
    expect((data as any).quantity).toBe(10);
  });

  it("class-pass: a save that omits Allowed keeps stored types and adds the override type", async () => {
    const cfg = classPassTypesCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        quantity: 10,
        eventTypeOverrides: [{ eventType: 2, quantity: 4 }],
      },
      originalDoc: { allowedEventTypes: [1], quantity: 10 },
    } as any);

    expect((data as any).allowedEventTypes).toEqual([1, 2]);
    expect((data as any).quantity).toBe(10);
  });

  it("class-pass: a save that omits Allowed still accepts an override type already stored", async () => {
    const cfg = classPassTypesCollection();
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        quantity: 10,
        eventTypeOverrides: [{ eventType: 1, quantity: 4 }],
      },
      originalDoc: { allowedEventTypes: [1], quantity: 10 },
    } as any);

    expect((data as any).allowedEventTypes).toBeUndefined();
    expect((data as any).eventTypeOverrides[0].eventType).toBe(1);
    expect((data as any).quantity).toBe(4);
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

  it("plans: a row with Interval and blank Per saves Per as 1", async () => {
    const cfg = generatePlansCollection({} as any);
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        allowedEventTypes: [2],
        sessionsInformation: {
          eventTypeOverrides: [{ eventType: 2, sessions: 2, interval: "week" }],
        },
      },
    } as any);

    expect((data as any).sessionsInformation.eventTypeOverrides[0].intervalCount).toBe(1);
  });

  it("plans: an override event type is added to Allowed and the row stays", async () => {
    const cfg = generatePlansCollection({} as any);
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        allowedEventTypes: [1],
        sessionsInformation: {
          eventTypeOverrides: [{ eventType: 2, sessions: 2, interval: "week", intervalCount: 1 }],
        },
      },
    } as any);

    expect((data as any).allowedEventTypes).toEqual([1, 2]);
    expect((data as any).sessionsInformation.eventTypeOverrides).toEqual([
      { eventType: 2, sessions: 2, interval: "week", intervalCount: 1 },
    ]);
  });

  it("plans: an event type already allowed and overridden stays in Allowed once", async () => {
    const cfg = generatePlansCollection({} as any);
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        allowedEventTypes: [1, 2],
        sessionsInformation: {
          eventTypeOverrides: [{ eventType: 2, sessions: 2, interval: "week", intervalCount: 1 }],
        },
      },
    } as any);

    expect((data as any).allowedEventTypes).toEqual([1, 2]);
  });

  it("plans: a save that omits Allowed keeps stored types and adds the override type", async () => {
    const cfg = generatePlansCollection({} as any);
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        sessionsInformation: {
          eventTypeOverrides: [{ eventType: 2, sessions: 2, interval: "week", intervalCount: 1 }],
        },
      },
      originalDoc: { allowedEventTypes: [1] },
    } as any);

    expect((data as any).allowedEventTypes).toEqual([1, 2]);
  });

  it("plans: a save that omits Allowed still accepts an override type already stored", async () => {
    const cfg = generatePlansCollection({} as any);
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    const data = await hook({
      data: {
        sessionsInformation: {
          eventTypeOverrides: [{ eventType: 1, sessions: 2, interval: "week", intervalCount: 1 }],
        },
      },
      originalDoc: { allowedEventTypes: [1] },
    } as any);

    expect((data as any).allowedEventTypes).toBeUndefined();
    expect((data as any).sessionsInformation.eventTypeOverrides[0].eventType).toBe(1);
  });

  it("plans: a row with Per and blank Interval is rejected", async () => {
    const cfg = generatePlansCollection({} as any);
    const hook = cfg.hooks?.beforeValidate?.[0];
    if (!hook) throw new Error("missing beforeValidate hook");

    await expect(
      hook({
        data: {
          allowedEventTypes: [2],
          sessionsInformation: {
            eventTypeOverrides: [{ eventType: 2, sessions: 2, intervalCount: 2 }],
          },
        },
      } as any),
    ).rejects.toThrow("Set Interval when Per is set, or leave both blank.");
  });
});


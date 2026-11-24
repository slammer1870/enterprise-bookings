/**
 * A save the admin can put right must say why it was refused.
 * Payload shows an error's message in the admin toast only when the error is a client error;
 * for anything else the toast reads "Something went wrong.". Each refusal here must be a 400.
 */
import { describe, expect, it } from "vitest";

import { classPassTypesCollection } from "../src/class-pass/collections/class-pass-types";
import { classPassesCollection } from "../src/class-pass/collections/class-passes";
import { createDecrementClassPassHook } from "../src/class-pass/hooks/decrementClassPassOnBookingConfirmed";
import { coursesCollection } from "../src/course/collections/courses";
import { generatePlansCollection } from "../src/membership/collections/plans";
import { createBeforeSubscriptionChange } from "../src/membership/hooks/before-subscription-change";

type Hook = (_args: never) => unknown;

/** The first beforeValidate hook of a collection, which is where these collections validate a save. */
function beforeValidate(collection: { hooks?: { beforeValidate?: unknown[] } }): Hook {
  const hook = collection.hooks?.beforeValidate?.[0];
  if (!hook) throw new Error("missing beforeValidate hook");
  return hook as Hook;
}

const refusals: { refused: string; run: () => unknown; message: RegExp }[] = [
  {
    refused: "a plan allowance with Per set and Interval blank",
    run: () =>
      beforeValidate(generatePlansCollection({} as never))({
        data: {
          allowedEventTypes: [2],
          sessionsInformation: {
            eventTypeOverrides: [{ eventType: 2, sessions: 2, intervalCount: 2 }],
          },
        },
      } as never),
    message: /Set Interval when Per is set/,
  },
  {
    refused: "a plan that lists an event type on two allowances",
    run: () =>
      beforeValidate(generatePlansCollection({} as never))({
        data: {
          allowedEventTypes: [11, 12],
          sessionsInformation: {
            eventTypeOverrides: [
              { eventTypes: [11, 12], sessions: 2, interval: "week", intervalCount: 1 },
              { eventTypes: [12], sessions: 1, interval: "week", intervalCount: 1 },
            ],
          },
        },
      } as never),
    message: /Each event type can only be overridden once/,
  },
  {
    refused: "a class pass type that lists an event type on two rows",
    run: () =>
      beforeValidate(classPassTypesCollection())({
        data: {
          allowedEventTypes: [11, 12, 21],
          quantity: 10,
          eventTypeOverrides: [
            { eventTypes: [11, 12], quantity: 2 },
            { eventTypes: [12, 21], quantity: 2 },
          ],
        },
      } as never),
    message: /Each event type can only be overridden once/,
  },
  {
    refused: "a class pass created with an expiry date in the past",
    run: () =>
      beforeValidate(classPassesCollection({}))({
        data: { expirationDate: "2000-01-01T00:00:00.000Z" },
        operation: "create",
      } as never),
    message: /Expiration date must be in the future/,
  },
  {
    refused: "a class pass that lists an event type on two credit pools",
    run: () =>
      beforeValidate(classPassesCollection({}))({
        data: {
          eventTypeOverrides: [
            { eventTypes: [11, 12], quantity: 0 },
            { eventTypes: [12], quantity: 1 },
          ],
        },
        operation: "update",
      } as never),
    message: /Each event type can only be overridden once/,
  },
  {
    refused: "a course whose end date is before its start date",
    run: () =>
      beforeValidate(coursesCollection())({
        data: { accessWindowMode: "fixed", startDate: "2026-05-10", endDate: "2026-05-01" },
      } as never),
    message: /endDate must be on or after startDate/,
  },
  {
    refused: "a subscription saved for a tenant with no connected Stripe account",
    run: () =>
      createBeforeSubscriptionChange({
        scope: "connect",
        getStripeAccountIdForRequest: () => null,
      })({
        data: { user: 1, stripeSubscriptionId: "sub_1" },
        req: { payload: { logger: { info() {}, error() {} } } },
      } as never),
    message: /No connected Stripe account resolved/,
  },
  {
    refused: "confirming a booking paid with a class pass that no longer exists",
    run: () =>
      createDecrementClassPassHook({ getClassPassIdToDecrement: async () => 7 })({
        doc: { id: 1, status: "confirmed", timeslot: { id: 2, eventType: 3 } },
        previousDoc: { status: "pending" },
        context: {},
        req: { payload: { findByID: async () => null } },
      } as never),
    message: /Class pass not found/,
  },
];

describe("refusals the admin can act on", () => {
  it.each(refusals)("refuses $refused as a client error", async ({ run, message }) => {
    await expect(Promise.resolve().then(run)).rejects.toMatchObject({
      name: "APIError",
      status: 400,
      message: expect.stringMatching(message),
    });
  });
});

import { describe, expect, it } from "vitest";

import type { Plan, Subscription } from "@repo/shared-types";
import { getMembershipPlansForView } from "@repo/payments-next/src/components/membership-plan-filter";

const createPlan = (overrides: Partial<Plan> = {}): Plan =>
  ({
    id: 1,
    name: "Membership",
    status: "active",
    sessionsInformation: {
      sessions: 10,
      interval: "week",
      intervalCount: 1,
      allowMultipleBookingsPerTimeslot: false,
    },
    ...overrides,
  }) as unknown as Plan;

const createSubscription = (plan: Plan, overrides: Partial<Subscription> = {}): Subscription =>
  ({
    id: 1,
    status: "active",
    plan,
    ...overrides,
  }) as unknown as Subscription;

describe("membership plan filtering for booking quantity", () => {
  it("filters out memberships that do not allow multiple bookings when quantity exceeds one", () => {
    const singleSlotPlan = createPlan({
      id: 10,
      name: "Single Slot Membership",
      sessionsInformation: {
        sessions: 10,
        interval: "week",
        intervalCount: 1,
        allowMultipleBookingsPerTimeslot: false,
      },
    });
    const familyPlan = createPlan({
      id: 20,
      name: "Family Membership",
      sessionsInformation: {
        sessions: 10,
        interval: "week",
        intervalCount: 1,
        allowMultipleBookingsPerTimeslot: true,
      },
    });

    const plansForView = getMembershipPlansForView({
      allowedPlanDocs: [singleSlotPlan, familyPlan],
      eligiblePlansForQuantity: [familyPlan],
      quantity: 2,
      subscription: createSubscription(singleSlotPlan),
    });

    expect(plansForView.map((plan) => plan.id)).toEqual([20]);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildMultiItemSubscriptionUpgradeItems,
  findExactApplicationFeePercent,
  isStripePlatformFeeSubscriptionItem,
  selectPlanSubscriptionItem,
} from "../src/utils/subscription-upgrade-items";

function item(params: {
  id: string;
  priceId: string;
  productName?: string;
}): any {
  return {
    id: params.id,
    price: {
      id: params.priceId,
      product: params.productName
        ? { id: `prod_${params.id}`, name: params.productName, object: "product" }
        : `prod_${params.id}`,
    },
  };
}

describe("isStripePlatformFeeSubscriptionItem", () => {
  it("detects Platform fee product name", () => {
    expect(
      isStripePlatformFeeSubscriptionItem(
        item({ id: "si_fee", priceId: "price_fee", productName: "Platform fee" }),
      ),
    ).toBe(true);
    expect(
      isStripePlatformFeeSubscriptionItem(
        item({ id: "si_plan", priceId: "price_plan", productName: "Monthly" }),
      ),
    ).toBe(false);
  });
});

describe("selectPlanSubscriptionItem", () => {
  it("skips platform fee items", () => {
    const plan = item({ id: "si_plan", priceId: "price_plan", productName: "Monthly" });
    const fee = item({ id: "si_fee", priceId: "price_fee", productName: "Platform fee" });
    expect(selectPlanSubscriptionItem([fee, plan])?.id).toBe("si_plan");
  });
});

describe("buildMultiItemSubscriptionUpgradeItems", () => {
  it("updates plan and fee prices", () => {
    const updates = buildMultiItemSubscriptionUpgradeItems({
      items: [
        item({ id: "si_plan", priceId: "price_old", productName: "Monthly" }),
        item({ id: "si_fee", priceId: "price_fee_old", productName: "Platform fee" }),
      ],
      newPlanPriceId: "price_new",
      newFeePriceId: "price_fee_new",
    });
    expect(updates).toEqual([
      { id: "si_plan", price: "price_new" },
      { id: "si_fee", price: "price_fee_new" },
    ]);
  });

  it("deletes fee item when new fee is null", () => {
    const updates = buildMultiItemSubscriptionUpgradeItems({
      items: [
        item({ id: "si_plan", priceId: "price_old", productName: "Monthly" }),
        item({ id: "si_fee", priceId: "price_fee_old", productName: "Platform fee" }),
      ],
      newPlanPriceId: "price_new",
      newFeePriceId: null,
    });
    expect(updates).toEqual([
      { id: "si_plan", price: "price_new" },
      { id: "si_fee", deleted: true },
    ]);
  });

  it("adds a fee item when none exists", () => {
    const updates = buildMultiItemSubscriptionUpgradeItems({
      items: [item({ id: "si_plan", priceId: "price_old", productName: "Monthly" })],
      newPlanPriceId: "price_new",
      newFeePriceId: "price_fee_new",
    });
    expect(updates).toEqual([
      { id: "si_plan", price: "price_new" },
      { price: "price_fee_new", quantity: 1 },
    ]);
  });
});

describe("findExactApplicationFeePercent", () => {
  it("returns a percent that yields the fee on the total", () => {
    expect(findExactApplicationFeePercent({ feeCents: 100, totalCents: 2600 })).toBeTruthy();
  });
});

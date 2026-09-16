import { beforeEach, describe, expect, it, vi } from "vitest";

const { retrieveProduct } = vi.hoisted(() => ({
  retrieveProduct: vi.fn(),
}));

vi.mock("@repo/shared-utils", () => ({
  stripe: {
    products: {
      retrieve: retrieveProduct,
    },
  },
}));

describe("beforeProductChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveProduct.mockResolvedValue({
      id: "prod_membership",
      name: "Membership",
      active: true,
      default_price: {
        unit_amount: 5000,
        recurring: { interval: "month", interval_count: 1 },
      },
    });
  });

  it("preserves an explicit inactive status when updating an existing linked membership", async () => {
    const { beforeProductChange } = await import(
      "../src/membership/hooks/before-product-change"
    );

    const result = await beforeProductChange({
      data: {
        status: "inactive",
        stripeProductId: "prod_membership",
      },
      originalDoc: {
        id: 1,
        status: "active",
        stripeProductId: "prod_membership",
      },
      req: {
        context: {},
        payload: {
          logger: { info: vi.fn(), error: vi.fn() },
        },
      },
    } as never);

    expect(result).toMatchObject({ status: "inactive" });
    expect(retrieveProduct).not.toHaveBeenCalled();
  });
});

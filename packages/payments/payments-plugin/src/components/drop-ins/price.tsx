import { DiscountResult } from "@repo/shared-types";

export const PriceView = ({ price }: { price: DiscountResult }) => {
  return (
    <div>
      <div className="flex justify-start items-center text-lg font-medium my-4 gap-4">
        <span className="font-semibold">Total:</span>
        <div className="flex items-center gap-1">
          {price.discountApplied && (
            <span className="line-through text-red-400">
              €{price.totalAmountBeforeDiscount.toFixed(2)}
            </span>
          )}
          <span>€{price.totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

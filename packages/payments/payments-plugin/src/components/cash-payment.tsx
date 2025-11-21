"use client";

import { DropIn } from "@repo/shared-types";

export const CashPayment = ({ dropIn }: { dropIn: DropIn }) => {
  return (
    <div>
      <h1>Cash Payment</h1>
      <p>{dropIn.name}</p>
    </div>
  );
};

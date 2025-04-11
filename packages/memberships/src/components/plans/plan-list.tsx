import { Button } from "@repo/ui/components/ui/button";
import { Plan } from "@repo/shared-types";

import { PlanDetail } from "./plan-detail";

export const PlanList = ({ plans }: { plans: Plan[] }) => {
  return (
    <div>
      {plans.map((plan) => (
        <div key={plan.id}>
          <PlanDetail plan={plan} />
        </div>
      ))}
    </div>
  );
};

"use client";

import { Plan } from "@repo/shared-types";

import { PlanDetail } from "./plan-detail";

type PlanListProps = {
  plans: Plan[];
  actionLabel: string;
  onAction: (
    planId?: string,
    metadata?: { [key: string]: string | undefined }
  ) => Promise<void>;
};

export const PlanList = ({ plans, actionLabel, onAction }: PlanListProps) => {
  return (
    <div className="flex flex-col gap-4">
      {plans.map((plan) => (
        <div key={plan.id}>
          <PlanDetail
            plan={plan}
            actionLabel={actionLabel}
            onAction={onAction}
          />
        </div>
      ))}
    </div>
  );
};

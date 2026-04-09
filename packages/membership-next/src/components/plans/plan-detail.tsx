"use client";

import { useState } from "react";

import { useParams, usePathname } from "next/navigation";

import { Plan } from "@repo/shared-types";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

import { CircleCheck } from "lucide-react";

import { Price } from "../price";

import { Button } from "@repo/ui/components/ui/button";

import { toast } from "sonner";

type PlanDetailProps = {
  plan: Plan;
  actionLabel: string;
  PlanPriceSummary?: React.ComponentType<{ plan: Plan }>;
  /** When false, the action does not require a price ID (e.g. Manage Subscription / customer portal). Default true. */
  actionRequiresPriceId?: boolean;
  onAction: (
    _planId: string,
    _metadata?: { [key: string]: string | undefined }
  ) => Promise<void>;
};

export const PlanDetail = ({
  plan,
  actionLabel,
  PlanPriceSummary,
  actionRequiresPriceId = true,
  onAction,
}: PlanDetailProps) => {
  const [loading, setLoading] = useState(false);
  const priceData = plan.priceJSON
    ? JSON.parse(plan.priceJSON as string)
    : null;
  const id = priceData?.id;

  const pathname = usePathname();

  const params = useParams();

  const metadata =
    pathname && pathname.split("/")[1] === "bookings" && params?.id
      ? { timeslot_id: params.id as string }
      : undefined;

  const hasPriceId = typeof id === "string" && id.length > 0;
  const canPerformAction = actionRequiresPriceId ? hasPriceId : true;

  const handleAction = async () => {
    if (actionRequiresPriceId && !hasPriceId) {
      toast.error("This plan is not set up for checkout yet");
      return;
    }
    setLoading(true);
    try {
      await onAction(hasPriceId ? id : "", metadata);
    } catch {
      toast.error("Error redirecting to Stripe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col gap-2">
          <span className="font-light">{plan.name}</span>
          <Price product={plan} />
          {PlanPriceSummary ? <PlanPriceSummary plan={plan} /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {plan.features?.map(({ id, feature }) => (
          <div
            key={id}
            className="mb-2 text-sm flex items-center justify-start text-gray-500 gap-2"
          >
            <CircleCheck className="w-4 h-4 text-green-500" />
            <span className="text-sm">{feature}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleAction}
          disabled={loading || !canPerformAction}
          className="w-full"
        >
          {loading ? "Loading..." : actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
};

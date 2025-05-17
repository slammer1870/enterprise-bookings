"use client";

import { useParams, usePathname } from "next/navigation";

import { Plan } from "@repo/shared-types";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";

import { CircleCheck, Loader2 } from "lucide-react";

import { Price } from "../price";

import { Button } from "@repo/ui/components/ui/button";
import { useState } from "react";
type PlanDetailProps = {
  plan: Plan;
  actionLabel: string;
  onAction: (
    planId?: string,
    metadata?: { [key: string]: string | undefined }
  ) => Promise<void>;
};

export const PlanDetail = ({
  plan,
  actionLabel,
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
    pathname.split("/")[1] === "bookings" && params.id
      ? { lesson_id: params.id as string }
      : undefined;

  const handleAction = async () => {
    setLoading(true);
    try {
      await onAction(id, metadata);
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
        <Button onClick={handleAction} disabled={loading} className="w-full">
          {loading ? "Loading..." : actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
};

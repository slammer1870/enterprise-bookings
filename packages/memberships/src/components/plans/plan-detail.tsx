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

import { CircleCheck } from "lucide-react";

import { CheckoutSessionButton } from "../checkout-session-button";

import { Price } from "../price";

export const PlanDetail = ({ plan }: { plan: Plan }) => {
  const priceData = plan.priceJSON
    ? JSON.parse(plan.priceJSON as string)
    : null;
  const id = priceData?.id;

  const pathname = usePathname();

  const params = useParams();

  console.log("PARAMS", params);

  const metadata =
    pathname.split("/")[1] === "bookings" && params.id
      ? { lesson_id: params.id as string }
      : undefined;

  console.log("METADATA", metadata);

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
        {id && (
          <CheckoutSessionButton
            stripePriceID={id}
            cta="Subscribe"
            metadata={metadata}
          />
        )}
      </CardFooter>
    </Card>
  );
};

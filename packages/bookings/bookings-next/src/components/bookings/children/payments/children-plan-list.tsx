"use client";

import { Plan } from "@repo/shared-types";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";

/**
 * Lightweight plan list for children booking checkout.
 * Unlike the memberships PlanList/PlanDetail, this supports passing quantity + custom metadata.
 */
export function ChildrenPlanList({
  plans,
  actionLabel,
  isLoading,
  onCheckout,
  getCheckoutArgs,
}: {
  plans: Plan[];
  actionLabel: string;
  isLoading: boolean;
  onCheckout: (args: {
    priceId: string;
    quantity: number;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  }) => Promise<void>;
  getCheckoutArgs: (plan: Plan, priceId: string) => {
    quantity: number;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
  };
}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {plans.length > 0 ? (
        plans.map((plan) => {
          const priceData = plan.priceJSON ? JSON.parse(plan.priceJSON as string) : null;
          const priceId = priceData?.id as string | undefined;

          if (!priceId) return null;

          const checkoutArgs = getCheckoutArgs(plan, priceId);

          return (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="font-light">{plan.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Keep minimal — different apps have different plan feature shapes */}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  disabled={isLoading}
                  onClick={async () => {
                    await onCheckout({
                      priceId,
                      ...checkoutArgs,
                    });
                  }}
                >
                  {isLoading ? "Loading..." : actionLabel}
                </Button>
              </CardFooter>
            </Card>
          );
        })
      ) : (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          <p>No plans available.</p>
        </div>
      )}
    </div>
  );
}



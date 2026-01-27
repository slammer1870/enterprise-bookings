import React from "react";
import type { ViewDescriptionServerProps } from "payload";
import SyncStripeSubscriptionsButton from "./sync-button";

export function SyncStripe(_props: ViewDescriptionServerProps) {
  return (
    <div className="flex items-center justify-start gap-4 w-full">
      <div className="w-1/2">
        <h3 className="font-medium mb-1">Sync Stripe Options</h3>
        <p className="text-gray-500">
          All subscriptions, users and plans that exist in Stripe but not here
          will be synced (plans will be created if they don&apos;t exist but will not
          be assigned a Stripe Plan ID for manual configuration).
        </p>
      </div>
      <SyncStripeSubscriptionsButton />
    </div>
  );
}

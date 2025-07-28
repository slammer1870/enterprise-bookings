"use client";

import React, { useState } from "react";

import { Button, toast } from "@payloadcms/ui";
import { useRouter } from "next/navigation";

const SyncStripeSubscriptionsButton: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/sync-stripe-subscriptions", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Stripe subscriptions synced successfully! ${data.newSubscriptions.length} new subscriptions added`
        );
      } else {
        toast.error(data.message || "Sync failed");
      }
    } catch (err) {
      toast.error((err as Error).message || "Sync failed");
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  return (
    <Button onClick={handleSync} disabled={loading}>
      {loading ? "Syncing..." : "Sync Stripe Subscriptions"}
    </Button>
  );
};

export default SyncStripeSubscriptionsButton;

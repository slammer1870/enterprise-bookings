"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Dynamic import of @payloadcms/ui so it (and react-image-crop's .css) is never
 * loaded during Node/tsx config resolution (e.g. payload migrate). Only the
 * browser loads it when this component mounts.
 */
type PayloadUI = { Button: React.ComponentType<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }>; toast: { success: (msg: string) => void; error: (msg: string) => void } };

const SyncStripeSubscriptionsButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [ui, setUi] = useState<PayloadUI | null>(null);
  const router = useRouter();

  useEffect(() => {
    void import("@payloadcms/ui").then((m) => setUi({ Button: m.Button, toast: m.toast }));
  }, []);

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/sync-stripe-subscriptions", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && res.status === 202) {
        ui?.toast.success(
          data.jobId
            ? "Sync queued. Subscriptions will update when the job completes."
            : "Sync queued."
        );
        setTimeout(() => router.refresh(), 2000);
      } else if (data.success) {
        ui?.toast.success("Sync completed.");
        router.refresh();
      } else {
        ui?.toast.error(data.message || "Sync failed");
      }
    } catch (err) {
      ui?.toast.error((err as Error).message || "Sync failed");
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  if (ui) {
    return (
      <ui.Button onClick={handleSync} disabled={loading}>
        {loading ? "Syncing..." : "Sync Stripe Subscriptions"}
      </ui.Button>
    );
  }
  return (
    <button type="button" onClick={handleSync} disabled={loading}>
      {loading ? "Syncing..." : "Sync Stripe Subscriptions"}
    </button>
  );
};

export default SyncStripeSubscriptionsButton;

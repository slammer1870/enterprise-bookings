"use client";

import { Button } from "@repo/ui/components/ui/button";
import { redirect } from "next/navigation";

import { toast } from "sonner";

export const CheckoutSessionButton = ({
  stripePriceID,
  quantity,
  metadata,
  cta,
}: {
  stripePriceID: string;
  cta?: string;
  quantity?: number;
  metadata?: { [key: string]: string | undefined };
}) => {
  const handleClick = async () => {
    toast.loading("Creating checkout session...");
    const response = await fetch("/api/stripe/create-checkout-session", {
      method: "POST",
      body: JSON.stringify({ price: stripePriceID, quantity, metadata }),
    });

    const data = await response.json();

    if (data.url) {
      redirect(data.url);
    } else {
      toast.error(data.message);
    }
  };
  return (
    <Button
      onClick={handleClick}
      disabled={!stripePriceID}
      variant="default"
      className="w-full"
    >
      {cta ? `${cta}` : "Buy Now"}
    </Button>
  );
};

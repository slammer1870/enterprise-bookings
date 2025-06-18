"use client";

import { useEffect, useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
  Elements,
} from "@stripe/react-stripe-js";

import {
  Appearance,
  loadStripe,
  StripePaymentElementOptions,
} from "@stripe/stripe-js";

import { Button } from "@repo/ui/components/ui/button";

import CardSkeleton from "./card-skeleton";

// Make sure to call loadStripe outside of a component’s render to avoid
// recreating the Stripe object on every render.
// This is your test publishable API key.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function PaymentForm({ priceComponent }: { priceComponent: React.ReactNode }) {
  const stripe = useStripe();
  const elements = useElements();

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Make sure to change this to your payment completion page
        return_url: "http://localhost:3000/dashboard",
      },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`. For some payment methods like iDEAL, your customer will
    // be redirected to an intermediate site first to authorize the payment, then
    // redirected to the `return_url`.
    if (error.type === "card_error" || error.type === "validation_error") {
      setMessage(error.message || "An unexpected error occurred.");
    } else {
      setMessage("An unexpected error occurred.");
    }

    setIsLoading(false);
  };

  const paymentElementOptions = {
    layout: "accordion",
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="flex flex-col">
      <PaymentElement
        id="payment-element"
        options={paymentElementOptions as StripePaymentElementOptions}
      />
      <div className="flex justify-between items-center">
        {priceComponent}
        <Button
          disabled={isLoading || !stripe || !elements}
          id="submit"
          className="ml-auto"
        >
          <span id="button-text">
            {isLoading ? (
              <div className="spinner" id="spinner">
                Submitting...
              </div>
            ) : (
              "Pay now"
            )}
          </span>
        </Button>
      </div>
      {/* Show any error or success messages */}
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
}

export default function CheckoutForm({
  price,
  priceComponent,
}: {
  price: number;
  priceComponent: React.ReactNode;
}) {
  const appearance = {
    theme: "stripe",
  } as Appearance;

  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    const createCheckoutSession = async () => {
      const response = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price,
        }),
      });

      const data = await response.json();
      setClientSecret(data.clientSecret);
    };

    createCheckoutSession();
  }, [price]);

  if (!clientSecret) {
    return <CardSkeleton />;
  }

  return (
    <Elements stripe={stripePromise} options={{ appearance, clientSecret }}>
      <PaymentForm priceComponent={priceComponent} />
    </Elements>
  );
}

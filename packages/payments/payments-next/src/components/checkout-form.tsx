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

import { useAnalyticsTracker } from "@repo/analytics";

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
// This is your test publishable API key.
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function PaymentForm({
  priceComponent,
  price,
}: {
  priceComponent: React.ReactNode;
  price: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { trackEvent } = useAnalyticsTracker();

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
    trackEvent("Payment Button Clicked", {
      revenue: { amount: Number(price.toFixed(2)), currency: "EUR" },
    });

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Make sure to change this to your payment completion page
        return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/dashboard`,
      },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`. For some payment methods like iDEAL, your customer will
    // be redirected to an intermediate site first to authorize the payment, then
    // redirected to the `return_url`.
    if (
      error &&
      (error.type === "card_error" || error.type === "validation_error")
    ) {
      setMessage(error.message || "An unexpected error occurred.");
    } else if (error) {
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
  metadata,
}: {
  price: number;
  priceComponent: React.ReactNode;
  metadata?: { [key: string]: string };
}) {
  const appearance = {
    theme: "stripe",
  } as Appearance;

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const createCheckoutSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log("Creating payment intent with price:", price);

        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price,
            metadata,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Payment intent creation failed:", {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });

          let errorMessage = "Failed to initialize payment";

          if (response.status === 401) {
            errorMessage = "You must be logged in to make a payment";
          } else if (response.status === 400) {
            errorMessage = "Invalid payment request";
          } else if (response.status >= 500) {
            errorMessage = "Server error - please try again later";
          }

          setError(errorMessage);
          return;
        }

        const data = await response.json();

        if (!data.clientSecret) {
          console.error("No client secret received from payment intent");
          setError("Failed to initialize payment - missing client secret");
          return;
        }

        console.log("Payment intent created successfully");
        setClientSecret(data.clientSecret);
      } catch (err) {
        console.error("Error creating payment intent:", err);
        setError("Network error - please check your connection and try again");
      } finally {
        setIsLoading(false);
      }
    };

    createCheckoutSession();
  }, [price, metadata]);

  // Check if Stripe is properly configured
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured");
      setError("Payment system is not properly configured");
    }
  }, []);

  if (error) {
    return (
      <div className="p-4 border border-red-200 rounded-md bg-red-50">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-600 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isLoading || !clientSecret) {
    return <CardSkeleton />;
  }

  return (
    <Elements stripe={stripePromise} options={{ appearance, clientSecret }}>
      <PaymentForm priceComponent={priceComponent} price={price} />
    </Elements>
  );
}


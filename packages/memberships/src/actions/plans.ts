"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const createCheckoutSession = async (
  planId: string,
  metadata?: { [key: string]: string | undefined }
) => {
  const cookieStore = await cookies();
  const token = cookieStore.get("payload-token")?.value;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-checkout-session`,
    {
      method: "POST",
      body: JSON.stringify({ price: planId, quantity: 1, metadata }),
      headers: { Authorization: `JWT ${token}` },
    }
  );

  const data = await response.json();

  if (data.url) {
    redirect(data.url);
  } else {
    throw new Error("Failed to create checkout session");
  }
};

export const createCustomerPortal = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("payload-token")?.value;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/api/stripe/create-customer-portal`,
    {
      method: "POST",
      headers: { Authorization: `JWT ${token}` },
    }
  );
  const data = await response.json();

  if (data.url) {
    redirect(data.url);
  } else {
    throw new Error("Failed to create customer portal");
  }
};

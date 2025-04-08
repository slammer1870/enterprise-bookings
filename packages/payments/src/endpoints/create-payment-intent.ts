"use server";

import { stripe, formatAmountForStripe } from "@repo/shared-utils";

import { calculateQuantityDiscount } from "../utils/discount";

import { APIError, CollectionSlug, PayloadHandler } from "payload";

import { DropIn, User } from "@repo/shared-types";

export const createPaymentIntent: PayloadHandler = async (
  req
): Promise<Response> => {
  if (!req.json) {
    throw new APIError("Invalid request body", 400);
  }

  const { user } = req as { user: User };

  if (!user) {
    throw new APIError("Unauthorized", 401);
  }

  const { price, quantity = 1, lessonId, dropInId } = await req.json();

  let amount = price;
  let discountResult = {
    originalPrice: price,
    discountedPrice: price,
    totalAmount: price * quantity,
    discountApplied: false,
  };

  // Apply quantity-based discount if a dropInId is provided
  if (dropInId) {
    try {
      const dropIn = (await req.payload.findByID({
        collection: "drop-ins" as CollectionSlug,
        id: dropInId,
      })) as unknown as DropIn;

      if (dropIn) {
        discountResult = calculateQuantityDiscount(
          price,
          quantity,
          dropIn.discountTiers || []
        );

        amount = discountResult.totalAmount;
      } else {
        amount = price * quantity;
      }
    } catch (error) {
      req.payload.logger.error(`Error applying discount: ${error}`);
      amount = price * quantity;
    }
  } else {
    amount = price * quantity;
  }

  const metadata: { [key: string]: string } = {};
  if (lessonId) {
    metadata.lessonId = lessonId;
    metadata.userId = user.id.toString();
  }

  if (dropInId) {
    metadata.dropInId = dropInId;
    metadata.quantity = quantity.toString();

    if (discountResult.discountApplied) {
      metadata.originalPrice = discountResult.originalPrice.toString();
      metadata.discountedPrice = discountResult.discountedPrice.toString();
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: formatAmountForStripe(amount, "eur"),
    automatic_payment_methods: { enabled: true },
    currency: "eur",
    receipt_email: user.email,
    customer: user.stripeCustomerId || undefined,
    metadata: metadata,
  });

  return new Response(
    JSON.stringify({
      clientSecret: paymentIntent.client_secret as string,
      amount: amount,
      ...discountResult,
    }),
    {
      status: 200,
    }
  );
};

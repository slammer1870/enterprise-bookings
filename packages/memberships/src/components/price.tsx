"use client";

import React, { useEffect, useState } from "react";

import { Plan } from "@repo/shared-types";

export const priceFromJSON = (
  priceJSON: string | null | undefined,
  quantity: number = 1,
  raw?: boolean
): string => {
  let price = "";

  if (priceJSON) {
    try {
      const parsed = JSON.parse(priceJSON);
      const priceValue = parsed.unit_amount * quantity;
      const priceType = parsed.type;

      if (raw) return priceValue.toString();

      price = (priceValue / 100).toLocaleString("en-US", {
        style: "currency",
        currency: parsed.currency, // TODO: use `parsed.currency`
      });

      if (priceType === "recurring") {
        price += `/${
          parsed.recurring.interval_count > 1
            ? `${parsed.recurring.interval_count} ${parsed.recurring.interval}`
            : parsed.recurring.interval
        }`;
      }
    } catch (e) {
      console.error(`Cannot parse priceJSON`); // eslint-disable-line no-console
    }
  }

  return price;
};

export const Price: React.FC<{
  product: Plan;
  quantity?: number;
  button?: "addToCart" | "removeFromCart" | false;
}> = (props) => {
  const { product: { priceJSON } = {}, quantity = 1 } = props;

  const [price, setPrice] = useState<{
    actualPrice: string;
    withQuantity: string;
  }>(() => ({
    actualPrice: priceFromJSON(priceJSON),
    withQuantity: priceFromJSON(priceJSON, quantity),
  }));

  useEffect(() => {
    setPrice({
      actualPrice: priceFromJSON(priceJSON),
      withQuantity: priceFromJSON(priceJSON, quantity),
    });
  }, [priceJSON, quantity]);

  return (
    <div>
      {typeof price?.actualPrice !== "undefined" &&
        price?.withQuantity !== "" && (
          <div className="font-medium text-xl">
            <p>{price?.withQuantity}</p>
            {quantity && quantity > 1 && (
              <small className="text-sm text-gray-500">{`${price.actualPrice} x ${quantity}`}</small>
            )}
          </div>
        )}
    </div>
  );
};

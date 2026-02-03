import { dropInsCollection } from "../payments/collections/drop-ins";
import type { DropInsConfig } from "../types";
import type { PluginContext } from "./context";
import { forEachPaymentMethodSlug } from "./forEachPaymentMethodSlug";
import { injectAllowedDropInIntoCollection } from "./inject-payment-methods";

/**
 * Applies the drop-ins feature: drop-ins collection and allowedDropIn injection
 * into the configured payment-method collections. Independent of payments processing.
 */
export function applyDropInsFeature(
  ctx: PluginContext,
  dropIns: DropInsConfig
): void {
  if (!dropIns.paymentMethodSlugs?.length) {
    throw new Error("dropIns.paymentMethodSlugs is required when dropIns.enabled is true");
  }

  ctx.collections = ctx.collections.filter((c) => c.slug !== "drop-ins");

  const joinFields = forEachPaymentMethodSlug(
    ctx,
    dropIns.paymentMethodSlugs,
    injectAllowedDropInIntoCollection,
    { on: "paymentMethods.allowedDropIn", hasMany: false }
  );

  const dropInsCollectionConfig = dropInsCollection({
    acceptedPaymentMethods: dropIns.acceptedPaymentMethods ?? ["cash", "card"],
    overrides: dropIns.dropInsOverrides,
  });

  dropInsCollectionConfig.fields = [
    ...(dropInsCollectionConfig.fields ?? []),
    ...joinFields,
  ];

  ctx.collections.push(dropInsCollectionConfig);
}

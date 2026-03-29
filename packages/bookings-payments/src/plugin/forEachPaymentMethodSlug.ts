import type { CollectionConfig, CollectionSlug } from "payload";
import type { PluginContext } from "./context";

export type JoinFieldResult = {
  name: string;
  label: string;
  type: "join";
  collection: CollectionSlug;
  on: string;
  hasMany: boolean;
};

function getPaymentMethodsJoinLabel(_collection: CollectionConfig, slug: string): string {
  const singular = (_collection as { labels?: { singular?: string } })?.labels?.singular;
  return `${singular ?? slug} Payment Methods`;
}

/**
 * For each slug: find collection (throw if missing), call inject(collection, slug), then
 * build a join field. Returns the array of join field configs.
 */
export function forEachPaymentMethodSlug(
  ctx: PluginContext,
  slugs: string[],
  inject: (_collection: CollectionConfig, _slug: string) => void,
  joinOptions: { on: string; hasMany: boolean }
): JoinFieldResult[] {
  const joinFields: JoinFieldResult[] = [];
  for (const slug of slugs) {
    const collection = ctx.collections.find((c) => c.slug === slug);
    if (!collection) throw new Error(`Collection ${slug} not found`);
    inject(collection, slug);
    joinFields.push({
      name: `${slug}PaymentMethods`,
      label: getPaymentMethodsJoinLabel(collection, slug),
      type: "join",
      collection: slug as CollectionSlug,
      on: joinOptions.on,
      hasMany: joinOptions.hasMany,
    });
  }
  return joinFields;
}

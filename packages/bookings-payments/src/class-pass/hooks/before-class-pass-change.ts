import type { CollectionBeforeChangeHook } from "payload";

/**
 * Auto-fills price from the class pass type's priceInformation when creating a class pass.
 * The type's price is in euros (synced from Stripe); we store price paid in cents.
 */
export const beforeClassPassChange: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== "create") return data;

  const typeRef = data?.type;
  if (typeRef == null) return data;

  const typeId =
    typeof typeRef === "object" && typeRef !== null && "id" in typeRef
      ? (typeRef as { id: number }).id
      : typeof typeRef === "number"
        ? typeRef
        : null;

  if (typeId == null) return data;

  try {
    const type = await req.payload.findByID({
      collection: "class-pass-types" as import("payload").CollectionSlug,
      id: typeId,
      depth: 0,
      overrideAccess: true,
    });

    const priceEur =
      (type as { priceInformation?: { price?: number } })?.priceInformation?.price ??
      undefined;
    const priceCents =
      priceEur != null ? Math.round(priceEur * 100) : undefined;

    if (priceCents != null) {
      (data as Record<string, unknown>).price = priceCents;
    }
  } catch {
    // Type not found or no price; leave data unchanged
  }

  return data;
};

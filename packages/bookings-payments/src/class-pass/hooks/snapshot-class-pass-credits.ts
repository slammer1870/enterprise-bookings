import type { CollectionBeforeChangeHook, CollectionSlug } from "payload";
import {
  classPassSharedPoolIsDisplayOnly,
  relationId,
  snapshotClassPassCredits,
} from "@repo/shared-services";

/**
 * When an admin creates a pass and leaves the credit snapshot empty,
 * copy the spendable shared quantity and override rows from the pass type.
 */
export const snapshotClassPassCreditsOnCreate: CollectionBeforeChangeHook = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== "create" || !data || typeof data !== "object") return data;
  const doc = data as {
    type?: unknown;
    quantity?: unknown;
    eventTypeOverrides?: unknown;
  };
  const quantityProvided = doc.quantity != null;
  // Payload sends [] for an array the admin left empty. That is not a snapshot.
  const overridesProvided =
    Array.isArray(doc.eventTypeOverrides) && doc.eventTypeOverrides.length > 0;
  if (quantityProvided && overridesProvided) return data;

  const typeId = relationId(doc.type);
  if (typeId == null) return data;

  const passType = (await req.payload
    .findByID({
      collection: "class-pass-types" as CollectionSlug,
      id: typeId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    .catch(() => null)) as {
    quantity?: unknown;
    allowedEventTypes?: unknown;
    eventTypeOverrides?: Array<{ eventType?: unknown; quantity?: number | null }> | null;
  } | null;
  if (!passType) return data;

  const snapshot = snapshotClassPassCredits(passType);
  // A display-only product stores shared quantity 0. An admin-entered sum would be a second pool.
  if (
    !quantityProvided ||
    (!overridesProvided && classPassSharedPoolIsDisplayOnly(passType))
  ) {
    doc.quantity = snapshot.quantity;
  }
  if (!overridesProvided) doc.eventTypeOverrides = snapshot.eventTypeOverrides;
  return data;
};

import type { CollectionConfig } from "payload";
import { userSubscription } from "../fields/subscription";

export function modifyUsersCollectionForMembership(
  existingCollectionConfig: CollectionConfig
): CollectionConfig {
  const fields = existingCollectionConfig.fields ?? [];
  const existingSubscriptionField = fields.find(
    (f) => "name" in f && f.name === "userSubscription"
  );
  if (!existingSubscriptionField) {
    fields.push(userSubscription);
  }
  return { ...existingCollectionConfig, fields };
}

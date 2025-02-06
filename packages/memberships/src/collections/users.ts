import { CollectionConfig } from "payload";

import { userSubscription } from "../fields/subscription";

export const modifyUsersCollection = (
  existingCollectionConfig: CollectionConfig
): CollectionConfig => {
  const fields = existingCollectionConfig.fields || [];

  const existingSubscriptionField = fields.find(
    (field) => "userSubscription" in field
  );

  if (!existingSubscriptionField) {
    fields.push(userSubscription);
  }

  return {
    ...existingCollectionConfig,
    fields,
  };
};

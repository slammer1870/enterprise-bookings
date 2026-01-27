import type { Field } from "payload";
import type { CollectionSlug } from "payload";

export const userSubscription: Field = {
  name: "userSubscription",
  type: "join",
  collection: "subscriptions" as CollectionSlug,
  on: "user",
};

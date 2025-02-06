import { Field, CollectionSlug } from "payload";

export const userSubscription: Field = {
  name: "userSubscription",
  type: "join",
  collection: "subscriptions" as CollectionSlug,
  on: "user",
};
